# Chemical structures

Two ways to show a molecule, both from SMILES, drawn in the browser by smiles-drawer.

**The term is a molecule** — put it in the frontmatter and it appears on the card and the term page:

```yaml
smiles: OC(=O)c1ccccc1O
```

**A structure inside the text** — a fenced block, one SMILES per line:

````markdown
```smiles
CC(=O)Oc1ccccc1C(=O)O
```
````

Invalid SMILES render as an inline error with the offending string. Reaction SMILES (`A>>B`) are drawn as reactions.
