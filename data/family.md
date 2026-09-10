# Familie Bauer

Everything the app shows lives in this file. Edit it, reload, done.
Prose like this paragraph is ignored — only the ```family block below is parsed.

## Syntax

| Statement | Meaning |
| --- | --- |
| `person <id> "<Name>" key=value ...` | declares a person. Keys: `born`, `died`, `photo`, `maiden`, `nick`, `note` |
| `<a> + <b> married=1956 divorced=1974` | a partnership. Remarriage = a second `+` line with the new partner |
| `<a> + <b> -> <child>, <child>` | children of that partnership |
| `<a> -> <child>` | children whose second parent is unknown |
| `%% ...` | comment |

Ids are the deep-link handles (`#/p/klaus`), so keep them short and lowercase.
Photos are file names inside `data/photos/`.

## The tree

```family
%% ---- Generation 1 -------------------------------------------------------
person heinrich  "Heinrich Bauer"    born=1931-04-02 died=2011-08-17 photo=heinrich.svg note="Baute das Haus in Lindau."
person elisabeth "Elisabeth Bauer"   born=1934-11-23 maiden=Vogt photo=elisabeth.svg nick=Oma
person werner    "Werner Schmitt"    born=1935-06-30 died=2019-02-11
person ingrid    "Ingrid Schmitt"    born=1939-09-08 maiden=Hoffmann photo=ingrid.svg

heinrich + elisabeth married=1956-05-19 -> klaus, brigitte
werner + ingrid married=1960 -> sabine, thomas

%% ---- Generation 2 -------------------------------------------------------
person klaus    "Klaus Bauer"        born=1958-01-14 note="Erzählt jedes Jahr dieselbe Bootsgeschichte."
person sabine   "Sabine Schmitt"     born=1962-07-21
person carmen   "Carmen Bauer"       born=1968-03-05 maiden=Ortiz
person brigitte "Brigitte Keller"    born=1961-10-02 maiden=Bauer
person martin   "Martin Keller"      born=1959-12-19
person thomas   "Thomas Schmitt"     born=1965-04-27 nick=Tommy
person petra    "Petra Schmitt"      born=1967-08-30 maiden=Lange

%% Married, divorced, married again — all three states in one branch.
klaus + sabine married=1984-06-09 divorced=1996 -> nina, jonas
klaus + carmen married=2001-09-15 -> luca
brigitte + martin married=1988-05-28 -> felix, hanna
thomas + petra married=1992 -> marie

%% ---- Generation 3 -------------------------------------------------------
person nina  "Nina Falk"    born=1986-02-17 maiden=Bauer
person tim   "Tim Falk"     born=1984-11-04
person jonas "Jonas Bauer"  born=1989-05-23 note="Wohnt jetzt in Lissabon."
person luca  "Luca Bauer"   born=2003-07-12
person felix "Felix Keller" born=1990-03-31
person ayla  "Ayla Keller"  born=1991-01-25 maiden=Demir
person hanna "Hanna Keller" born=1993-06-14
person marie "Marie Schmitt" born=1994-10-09

nina + tim married=2014-08-16 -> mia, ben
felix + ayla married=2019-06-01 -> emil

%% ---- Generation 4 -------------------------------------------------------
person mia  "Mia Falk"      born=2016-04-03
person ben  "Ben Falk"      born=2019-09-27
person emil "Emil Keller"   born=2022-12-05
```
