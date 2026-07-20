DELETE FROM "choferes_unidades"
WHERE "chofer_id" IN (SELECT "id" FROM "choferes" WHERE "activo" = false)
   OR "camion_id" IN (SELECT "id" FROM "camiones" WHERE "activo" = false);
