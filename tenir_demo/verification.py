"""Vérification hors moteur : signatures, chaîne, dossier et cohérence des traces."""
from .evidence import digest, key_id, verify


def check(condition, message):
    if not condition:
        raise ValueError(message)


def verify_bundle(bundle, public_key, signal_key):
    try:
        core = {k: v for k, v in bundle.items() if k != "attestation"}
        attestation = bundle["attestation"]
        check(verify(attestation, public_key), "Signature du dossier invalide")
        check(attestation["payload"] == {"schema": "demo-dossier/v1", "bundle_sha256": digest(core),
                                          "record_count": len(core["records"])}, "Dossier altéré ou tronqué")
        check(core["schema"] == "demo-bundle/v1", "Contrat de dossier inconnu")
        check(core["signal_public_key_id"] == key_id(signal_key), "Clé d'observation inattendue")
        records, profile = core["records"], core["profile"]
        check(bool(records), "Dossier sans preuve")
        latest, first, known_journal = {}, {}, []
        previous, budget = None, {"ceiling": profile["ceiling"], "consumed": 0, "reserved": 0, "available": profile["ceiling"]}
        for index, record in enumerate(records, 1):
            check(verify(record, public_key), f"Signature invalide à la preuve {index}")
            p = record["payload"]
            check(p["schema"] == "demo-evidence/v1" and p["simulation_only"] is True, "Contrat de preuve incorrect")
            check(p["sequence"] == index and p["previous_hash"] == previous, "Chaîne discontinue")
            check(p["profile"] == profile and p["profile_hash"] == digest(profile), "Profil incohérent")
            check(p["request_hash"] == digest(p["request"]), "Empreinte de demande incorrecte")
            oid = p["operation_id"]
            check(oid == p["request"]["operation_id"], "Identifiant incohérent")
            check(p["budget_before"] == budget, "Snapshot avant discontinu")
            verdict, state = p["decision"]["verdict"], p["operation_state"]
            expected = dict(budget)
            if oid not in first:
                first[oid] = p
                if verdict == "PASS":
                    check(p["event"] == "RESERVED_FOR_DISPATCH" and state == "DISPATCHING", "Réservation absente")
                    check(verify(p["request"]["signal"], signal_key), "Observation d'autorisation non signée")
                    amount = p["request"]["amount"]
                    check(type(amount) is int and amount > 0, "Montant autorisé invalide")
                    expected["reserved"] += amount
                else:
                    check((verdict, state) in (("HARD_VETO", "BLOCKED"), ("HOLD", "HELD")) and p["event"] == "NOT_SENT", "Arrêt incohérent")
            else:
                original = first[oid]
                check(p["request_hash"] == original["request_hash"] and p["decision"] == original["decision"], "Décision historique modifiée")
                check(latest[oid]["operation_state"] == "DISPATCHING" and p["event"] == "PROVIDER_RESULT" and state in ("CONFIRMED", "UNKNOWN"), "Transition inattendue")
                if state == "CONFIRMED":
                    expected["reserved"] -= p["request"]["amount"]
                    expected["consumed"] += p["request"]["amount"]
            expected["available"] = expected["ceiling"] - expected["consumed"] - expected["reserved"]
            check(min(expected.values()) >= 0 and p["budget_after"] == expected, "Budget ou réservation incohérent")
            budget = expected
            journal = p["provider_journal"]
            check(journal[:len(known_journal)] == known_journal, "Journal fournisseur réécrit")
            known_journal = journal
            latest[oid], previous = p, digest(record)
        check(core["final_budget"] == budget, "Budget final incohérent")
        check(core["provider_journal"] == known_journal, "Journal final incohérent")
        check(set(core["operations"]) == set(latest), "Registre incomplet")
        for oid, p in latest.items():
            expected_op = {"request": p["request"], "request_hash": p["request_hash"], "decision": p["decision"],
                           "state": p["operation_state"], "latest_evidence_sequence": p["sequence"]}
            check(core["operations"][oid] == expected_op, "Registre différent de la preuve")
            check(p["operation_state"] != "DISPATCHING", "Export en cours d'envoi : attendre sa stabilisation")
            calls = [c for c in known_journal if c["operation_id"] == oid]
            expected_count = 1 if p["decision"]["verdict"] == "PASS" else 0
            check(len(calls) == expected_count, "Nombre d'appels interdit ou doublon")
            for call in calls:
                check(call["request_hash"] == p["request_hash"] and call["amount"] == p["request"]["amount"]
                      and call["outcome"] == p["operation_state"], "Résultat fournisseur incohérent")
        check(all(c["operation_id"] in latest and c["call_id"] == i for i, c in enumerate(known_journal, 1)), "Appel sans opération ou numéro incorrect")
        return {"valid": True, "records": len(records), "operations": len(latest), "provider_calls": len(known_journal)}
    except (KeyError, ValueError, TypeError, IndexError) as error:
        return {"valid": False, "error": str(error)}
