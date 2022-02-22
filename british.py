import sqlite3

import json

con = sqlite3.connect("word2vec.db")
cur = con.cursor()

out = {}
with open("british_spellings.json") as f:
    british_to_american = json.load(f)
    for british, american in british_to_american.items():
        cur.execute("""select count(*) from word2vec where word=?""", (british,))
        count = cur.fetchone()[0]
        if not count:
            out[british] = american


with open("static/assets/js/british_spellings.js", "w") as f:
    f.write("unbritish=" + json.dumps(out))
