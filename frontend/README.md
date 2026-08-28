# StockLess frontend

Standalone. No backend needed to run it.

## Run

    npm install
    npm run dev

Open the address it prints (usually http://localhost:5173).

## Test it

1. Click "Use sample file" on screen 1.
2. On screen 2 you start at "0 of 7 confirmed". Confirm each row.
3. Below the table, pick an identity path and confirm it.
   Picking "composite" on the sample file surfaces an identity conflict,
   because two SKUs share the product name.
4. The dark panel on the right updates live as you confirm.
5. "Run readiness check" unlocks once date, quantity and identity are confirmed.
   It leads to a placeholder — steps 3 and 4 have no engine contract yet.

Also try uploading a .txt file on screen 1 to see the error path.

## Connecting the real engine

`src/engine.ts` is the only file that touches the engine. It currently
re-exports `src/engine.mock.ts`, which implements the same function names and
types as @stockless/backend. To switch over, change one line in engine.ts to

    export * from "@stockless/backend";

and delete engine.mock.ts. No screen changes.
