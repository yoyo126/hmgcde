import assert from "node:assert/strict";
import test from "node:test";
import { attribuerNumero, estDoublon } from "../models/numerotation.js";

/**
 * Ce calcul décide du numéro d'une commande, donc de la commande qu'on lit.
 * Le défaut qu'il ferme : le numéro était calculé par le navigateur et
 * l'enregistrement se faisait en « ON DUPLICATE KEY UPDATE », si bien que
 * deux commandes créées en même temps portaient le même numéro — et la
 * seconde écrasait la première.
 */

/** Erreur telle que la renvoie MySQL quand le numéro est déjà pris. */
const doublon = () => Object.assign(new Error("Duplicate entry"), {
  code: "ER_DUP_ENTRY",
  errno: 1062,
});

/** Compteur de base : « 49 », puis « 50 »… comme la lecture en base. */
const compteur = (depart = 49) => {
  let valeur = depart - 1;
  return async () => {
    valeur += 1;
    return `CMD-2026-${String(valeur).padStart(3, "0")}`;
  };
};

test("un numéro libre est attribué du premier coup", async () => {
  const ecrits = [];
  const numero = await attribuerNumero(compteur(), async (code) => {
    ecrits.push(code);
  });
  assert.equal(numero, "CMD-2026-049");
  assert.deepEqual(ecrits, ["CMD-2026-049"]);
});

test("un numéro pris entre-temps passe au suivant au lieu d'écraser", async () => {
  const pris = new Set(["CMD-2026-049", "CMD-2026-050"]);
  const tentatives = [];
  const numero = await attribuerNumero(compteur(), async (code) => {
    tentatives.push(code);
    if (pris.has(code)) throw doublon();
  });
  assert.equal(numero, "CMD-2026-051");
  assert.deepEqual(tentatives, ["CMD-2026-049", "CMD-2026-050", "CMD-2026-051"]);
});

test("le numéro renvoyé est celui qui a vraiment été écrit", async () => {
  let ecrit = null;
  const numero = await attribuerNumero(compteur(), async (code) => {
    if (code === "CMD-2026-049") throw doublon();
    ecrit = code;
  });
  assert.equal(numero, ecrit);
});

test("une panne remonte tout de suite, sans nouvelle tentative", async () => {
  const tentatives = [];
  await assert.rejects(
    attribuerNumero(compteur(), async (code) => {
      tentatives.push(code);
      throw new Error("Base de données injoignable");
    }),
    /injoignable/,
  );
  // Une seule tentative : réessayer sur une panne ferait perdre la commande
  // en la faisant passer pour une collision.
  assert.equal(tentatives.length, 1);
});

test("des collisions sans fin échouent franchement plutôt que de boucler", async () => {
  const tentatives = [];
  await assert.rejects(
    attribuerNumero(
      compteur(),
      async (code) => {
        tentatives.push(code);
        throw doublon();
      },
      4,
    ),
    /4 tentatives/,
  );
  assert.equal(tentatives.length, 4);
});

test("un doublon est reconnu par son nom comme par son numéro d'erreur", () => {
  assert.equal(estDoublon({ code: "ER_DUP_ENTRY" }), true);
  assert.equal(estDoublon({ errno: 1062 }), true);
  assert.equal(estDoublon({ code: "ECONNREFUSED" }), false);
  assert.equal(estDoublon(new Error("autre chose")), false);
  assert.equal(estDoublon(undefined), false);
});
