# Chemical structures

Structures come from SMILES and are drawn in the browser by smiles-drawer. There is no separate field: a SMILES lives wherever a name lives.

**In the name or an alias** — write `smiles:` followed by the SMILES (no spaces). It is drawn wherever the term is shown: the term page header, the term list, and both sides of the cards.

```yaml
term: Salicylic acid
aliases:
  - 2-hydroxybenzoic acid
  - smiles:OC(=O)c1ccccc1O
```

A name can mix text and a structure (`Aspirin smiles:CC(=O)Oc1ccccc1C(=O)O`); the slug and the browser title use the text only.

**Inside the note** — a fenced block, one SMILES per line:

````markdown
```smiles
CC(=O)Oc1ccccc1C(=O)O
```
````

Invalid SMILES render as an inline error with the offending string.

## Math in names

Names and aliases also accept `$…$` in the file's math dialect, so `$\zeta$-potential` or `Debye length $\lambda_D$` render properly. The slug is derived from the plain text (`zeta-potential`, `debye-length-lambda-d`).
