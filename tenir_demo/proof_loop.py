"""Read-only explanations with explicit sources; never evaluate or sign an action.

The caller verifies the evidence bundle. This projection only checks that each
declared source exists at the given location in an EvidenceRecord. Its prose is
documentary context, outside the signed payload.
"""
from copy import deepcopy
import re


SCHEMA = "demo-proof-loop/v1"
STAGE_IDS = ("question", "theoretical-model", "observation-model", "observation",
             "interpretation", "execution", "knowledge", "restitution")


def text(fr, en):
    return {"fr": fr, "en": en}


def resolve_source(records, source):
    """Resolve a strict RFC 6901 pointer and return a detached value.

    SIGNED_PAYLOAD identifies payload bytes, not a fresh verification result.
    Integrity-envelope metadata is labelled separately from signed payloads.
    """
    try:
        sequence, pointer, kind = source["record_sequence"], source["pointer"], source["kind"]
        if type(sequence) is not int or sequence <= 0 or not isinstance(pointer, str):
            raise ValueError("Invalid source identity")
        prefix = {"SIGNED_PAYLOAD": "/payload", "ENVELOPE_METADATA": "/integrity"}.get(kind)
        if prefix is None or not (pointer == prefix or pointer.startswith(prefix + "/")):
            raise ValueError("Source kind does not match its pointer")
        if re.search(r"~(?![01])", pointer):
            raise ValueError("Invalid RFC 6901 escape")
        matching = [record for record in records if record["payload"]["sequence"] == sequence]
        if len(matching) != 1:
            raise ValueError("Source record missing or ambiguous")
        value = matching[0]
        for part in pointer.split("/")[1:]:
            token = part.replace("~1", "/").replace("~0", "~")
            if isinstance(value, list):
                if not re.fullmatch(r"0|[1-9][0-9]*", token):
                    raise ValueError("Invalid array index")
                value = value[int(token)]
            elif isinstance(value, dict):
                value = value[token]
            else:
                raise ValueError("Source pointer traverses a scalar")
        return deepcopy(value)
    except (KeyError, IndexError, TypeError) as error:
        raise ValueError("Source field is missing or invalid") from error


def build_proof_loop(records):
    """Describe one operation, including its reservation and completion records."""
    try:
        if not isinstance(records, list) or not records:
            raise ValueError("At least one evidence record is required")
        sequences = [record["payload"]["sequence"] for record in records]
        if any(type(value) is not int or value <= 0 for value in sequences) or len(set(sequences)) != len(sequences):
            raise ValueError("Invalid or duplicate evidence sequences")
        ordered = sorted(records, key=lambda record: record["payload"]["sequence"])
        first, latest = ordered[0]["payload"], ordered[-1]["payload"]
        operation_id = first["operation_id"]
        if not isinstance(operation_id, str) or not operation_id or any(record["payload"]["operation_id"] != operation_id for record in ordered):
            raise ValueError("Proof loop must describe a single operation")
        start, end = first["sequence"], latest["sequence"]
        state, verdict = latest["operation_state"], first["decision"]["verdict"]
        if state not in ("CONFIRMED", "UNKNOWN", "BLOCKED", "HELD", "DISPATCHING") or verdict not in ("PASS", "HARD_VETO", "HOLD"):
            raise ValueError("Unsupported local evidence state")

        def source(sequence, pointer, fr, en, kind="SIGNED_PAYLOAD"):
            result = {"record_sequence": sequence, "pointer": pointer,
                      "label": text(fr, en), "kind": kind}
            resolve_source(ordered, result)
            return result

        def begin(pointer, fr, en):
            return source(start, pointer, fr, en)

        def finish(pointer, fr, en, kind="SIGNED_PAYLOAD"):
            return source(end, pointer, fr, en, kind)

        def stage(identity, fr, en, description, status, sources):
            return {"id": identity, "title": text(fr, en), "description": description,
                    "explanation_kind": "DOCUMENTARY", "status": status, "sources": sources}

        stages = [stage("question", "Question", "Question",
            text("Peut-on engager le montant demandé sur cette ressource, selon le profil et les observations enregistrés ? Cette question est une formulation du rapport ; aucun question_id n'est inscrit dans cette preuve.",
                 "Can the requested amount be committed on this resource under the recorded profile and observations? This question is report wording; this evidence contains no question_id."),
            "DOCUMENTARY", [begin("/payload/request/amount", "Montant demandé", "Requested amount"),
                            begin("/payload/request/unit", "Unité", "Unit"),
                            begin("/payload/profile/resource", "Ressource", "Resource")]),
            stage("theoretical-model", "Modèle de contrôle", "Control model",
            text("Le profil versionné définit le périmètre, le plafond et la politique du moteur local. Son admissibilité et ses garanties restent celles de cette démonstration.",
                 "The versioned profile defines scope, ceiling and local-engine policy. Its admissibility and guarantees remain those of this demonstration."),
            "RECORDED", [begin("/payload/profile", "Profil enregistré", "Recorded profile"),
                         begin("/payload/profile_hash", "Empreinte du profil", "Profile fingerprint"),
                         begin("/payload/prototype_version", "Version du moteur local", "Local engine version")]),
            stage("observation-model", "Protocole d'observation", "Observation protocol",
            text("La lecture de l'observation dépend de son émetteur, de la ressource, de son âge et du temps de référence. Ces paramètres sont enregistrés ; ce rapport ne relance pas les contrôles du moteur.",
                 "Reading the observation depends on its issuer, resource, age and reference time. These parameters are recorded; this report does not rerun engine checks."),
            "RECORDED", [begin("/payload/profile/signal_issuer", "Émetteur attendu", "Expected issuer"),
                         begin("/payload/profile/max_signal_age_seconds", "Âge maximal en secondes", "Maximum age in seconds"),
                         begin("/payload/reference_time", "Temps de référence", "Reference time"),
                         begin("/payload/profile/policy", "Politique enregistrée", "Recorded policy")])]

        signal, reasons = first["request"]["signal"], first["decision"]["reasons"]
        observation_status = ("MISSING" if signal is None else "INVALID" if "SIGNAL_INVALID" in reasons
                              else "EXPIRED" if "SIGNAL_EXPIRED" in reasons else "RECORDED")
        descriptions = {
            "MISSING": text("L'observation indispensable est absente : le champ signal vaut null. Le point d'arrêt est visible dans l'interprétation ; aucun signal de remplacement n'est inventé.",
                            "The required observation is absent: the signal field is null. Interpretation shows the stopping point; no substitute signal is invented."),
            "INVALID": text("Le moteur a enregistré SIGNAL_INVALID. Une enveloppe reçue ne suffit donc pas à établir une observation exploitable.",
                            "The engine recorded SIGNAL_INVALID. Receiving an envelope is therefore insufficient to establish a usable observation."),
            "EXPIRED": text("Le moteur a enregistré SIGNAL_EXPIRED. Les horodatages sont conservés dans le signal pour examiner cette décision historique.",
                            "The engine recorded SIGNAL_EXPIRED. Signal timestamps are preserved to inspect this historical decision."),
            "RECORDED": text("Le signal et ses données sont conservés dans le record. Le statut de l'hypothèse décrit l'observation ; le verdict reste une étape distincte.",
                             "The signal and its data are preserved in the record. Hypothesis status describes the observation; the verdict remains a separate stage.")}
        observation_sources = [begin("/payload/request/signal", "Signal reçu, y compris son absence", "Received signal, including its absence")]
        if isinstance(signal, dict) and isinstance(signal.get("payload"), dict):
            for field, fr, en in (("status", "État de l'hypothèse", "Hypothesis status"),
                                  ("observed_at", "Temps de l'observation", "Observation time"),
                                  ("expires_at", "Expiration", "Expiry")):
                if field in signal["payload"]:
                    observation_sources.append(begin("/payload/request/signal/payload/" + field, fr, en))
        stages.append(stage("observation", "Observation et donnée", "Observation and data", descriptions[observation_status], observation_status, observation_sources))
        stages.append(stage("interpretation", "Interprétation", "Interpretation",
            text("Le verdict et les motifs sont lus dans la première preuve de l'opération. Le budget affiché ici est celui du contrôle initial, avant la réservation ; le résultat fournisseur ne réécrit pas ce verdict.",
                 "The verdict and reasons are read from the operation's first evidence record. The budget shown here is the initial check snapshot, before reservation; the provider outcome does not rewrite that verdict."),
            {"PASS": "RECORDED", "HARD_VETO": "BLOCKED", "HOLD": "HELD"}[verdict],
            [begin("/payload/decision/verdict", "Verdict avant envoi", "Verdict before dispatch"),
             begin("/payload/decision/reasons", "Motifs enregistrés", "Recorded reasons"),
             begin("/payload/budget_before", "Budget du contrôle initial", "Initial check budget")]))
        execution_description = (
            text("L'envoi a été autorisé, puis le simulateur a confirmé son résultat. La réservation initiale et sa conversion en consommation sont deux événements distincts.",
                 "Dispatch was authorized, then the simulator confirmed its outcome. Initial reservation and conversion into consumption are separate events.") if state == "CONFIRMED" else
            text("PASS a autorisé l'envoi. Le retour est UNKNOWN : son effet n'est pas confirmé et la réservation reste conservée. Le journal est cumulatif ; ses autres entrées peuvent concerner des opérations précédentes.",
                 "PASS authorized dispatch. The outcome is UNKNOWN: its effect is unconfirmed and the reservation is retained. The journal is cumulative; other entries may concern earlier operations.") if state == "UNKNOWN" else
            text("Le verdict a arrêté l'opération avant l'envoi. L'événement NOT_SENT et l'état enregistré localisent cet arrêt. Le journal cumulatif peut contenir des appels d'autres opérations.",
                 "The verdict stopped the operation before dispatch. The NOT_SENT event and recorded state locate that stop. The cumulative journal may contain calls from other operations.") if state in ("BLOCKED", "HELD") else
            text("La réservation est enregistrée ; aucun résultat terminal n'est encore décrit par ces records.",
                 "Reservation is recorded; these records do not yet describe a terminal outcome."))
        execution_sources = [begin("/payload/event", "Premier événement", "First event"),
                             begin("/payload/budget_after", "Budget après le premier événement", "Budget after the first event"),
                             finish("/payload/event", "Dernier événement", "Latest event"),
                             finish("/payload/operation_state", "Résultat enregistré", "Recorded outcome"),
                             finish("/payload/provider_journal", "Journal cumulé du simulateur", "Cumulative simulator journal"),
                             finish("/payload/budget_after", "Budget après le dernier événement", "Budget after the latest event")]
        execution_sources = list({(item["record_sequence"], item["pointer"]): item for item in execution_sources}.values())
        stages.append(stage("execution", "Exécution contrôlée", "Controlled execution", execution_description,
                            {"CONFIRMED": "CONFIRMED", "UNKNOWN": "UNCONFIRMED", "BLOCKED": "BLOCKED", "HELD": "HELD", "DISPATCHING": "UNCONFIRMED"}[state], execution_sources))
        stages.append(stage("knowledge", "Connaissance et preuve", "Knowledge and evidence",
            text("Ce record conserve ce qui est connu à cet événement, y compris l'incertitude. Les champs du payload signé sont séparés des métadonnées de signature. Leur affichage ne remplace pas le vérificateur autonome.",
                 "This record preserves what is known at this event, including uncertainty. Signed payload fields are separated from signature metadata. Displaying them does not replace the standalone verifier."),
            "UNCONFIRMED" if state in ("UNKNOWN", "DISPATCHING") else "RECORDED",
            [finish("/payload/sequence", "Séquence de la preuve", "Evidence sequence"),
             finish("/payload/operation_state", "État connu à cet événement", "Known state at this event"),
             finish("/payload/previous_hash", "Lien vers la preuve précédente", "Link to previous evidence"),
             finish("/integrity/payload_sha256", "Empreinte du payload", "Payload fingerprint", "ENVELOPE_METADATA"),
             finish("/integrity/key_id", "Identifiant de clé", "Key identifier", "ENVELOPE_METADATA"),
             finish("/integrity/signature", "Signature à vérifier", "Signature to verify", "ENVELOPE_METADATA")]))
        stages.append(stage("restitution", "Restitution et suite", "Restitution and follow-up",
            text("Le rapport relie ces sources et explique leurs limites. Pour UNKNOWN, le suivi attendu consiste à établir l'issue avant toute relance ; cette page n'effectue pas de réconciliation. Une prochaine question d'audit reste un contexte documentaire.",
                 "The report connects these sources and explains their limits. For UNKNOWN, follow-up requires establishing the outcome before retrying; this page performs no reconciliation. A subsequent audit question remains documentary context."),
            "DOCUMENTARY", [finish("/payload/operation_id", "Opération examinée", "Operation under review"),
                            finish("/payload/operation_state", "Point de reprise de l'examen", "Review continuation point"),
                            finish("/payload/simulation_only", "Périmètre simulé", "Simulation scope")]))
        return {"schema": SCHEMA, "operation_id": operation_id, "record_sequence": end,
                "stages": stages,
                "timeline": [{"record_sequence": record["payload"]["sequence"],
                              "event": record["payload"]["event"],
                              "operation_state": record["payload"]["operation_state"],
                              "verdict": record["payload"]["decision"]["verdict"]} for record in ordered]}
    except (KeyError, TypeError, IndexError) as error:
        raise ValueError("Evidence is incomplete for the proof loop") from error
