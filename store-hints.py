import sqlite3

import pickle

con = sqlite3.connect('word2vec.db')
cur = con.cursor()
cur.execute("""create table if not exists nearby (word text, neighbor text, similarity float, percentile integer)""")

con.commit()
cur.execute("""create unique index if not exists nearby_words on nearby (word, neighbor)""")
con.commit()



with open(b"nearest.pickle", "rb") as f:
    nearest = pickle.load(f)

for i, (secret, neighbors) in enumerate(nearest.items()):
    if i % 1111 == 0:
        con.commit()
    for idx, (score, neighbor) in enumerate(neighbors):
        con.execute ("insert into nearby (word, neighbor, similarity, percentile) values (?, ?, ?, ?)", (secret, neighbor, score, i))

con.commit()
