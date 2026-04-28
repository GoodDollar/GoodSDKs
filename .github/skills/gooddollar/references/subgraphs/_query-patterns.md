# Subgraph query discipline (GoodDollar)

## Subgraph vs RPC

- **Subgraph:** historical events, lists, aggregates, time ranges, analytics. Data lags chain head.
- **RPC / SDK:** current balances, live `claim` eligibility, exact view calls. Prefer for user-facing “what is true right now”.

## Generic GraphQL mechanics

Graph-node generates `entity`, `entities`, `Entity_filter`, `Entity_orderBy`, pagination, and `_meta` from each deployment’s `schema.graphql`. For scalar rules, filters, `_meta`, and common pitfalls, see [The Graph — Querying a subgraph](https://thegraph.com/docs/en/querying/graphql-api/).

## GoodDollar-specific

- **Addresses in `where` clauses:** normalize to **lowercase** hex strings; subgraphs store addresses lowercased.
- **BigInt fields:** query as **string** literals in GraphQL JSON (e.g. `"1000000000000000000"`).
- **Schema truth:** entity names differ per deployment. Run introspection or read the deployment’s `schema.graphql` under the relevant package in [GoodDollar/GoodSubGraphs](https://github.com/GoodDollar/GoodSubGraphs) before assuming field names.

## Meta block

Use `_meta { block { number } }` to detect how far behind indexing is when debugging stale data.

```graphql
{
  _meta {
    block {
      number
    }
    hasIndexingErrors
  }
}
