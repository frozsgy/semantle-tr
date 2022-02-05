import sqlite3

import pickle

con = sqlite3.connect('word2vec.db')
cur = con.cursor()
cur.execute("""create table if not exists nearby (word text, neighbor text, similarity float, percentile integer)""")

con.commit()
cur.execute("""create unique index if not exists nearby_words on nearby (word, neighbor)""")
con.commit()

cur.execute("""create table if not exists similarity_range (word text, top float, top10 float, rest float)""")

cur.execute("""create unique index if not exists similarity_range_word on similarity_range (word)""")
con.commit()


with open(b"nearest.pickle", "rb") as f:
    nearest = pickle.load(f)

for i, (secret, neighbors) in enumerate(nearest.items()):
    if i % 1111 == 0:
        con.commit()
    for idx, (score, neighbor) in enumerate(neighbors):
        con.execute ("insert into nearby (word, neighbor, similarity, percentile) values (?, ?, ?, ?)", (secret, neighbor, "%s" % score, (1 + idx)))

    top = neighbors[-2][0]
    top10 = neighbors[-12][0]
    rest = neighbors[0][0]
    con.execute ("insert into similarity_range (word, top, top10, rest) values (?, ?, ?, ?)", (secret, "%s" % top, "%s" % top10, "%s" % rest))

con.commit()
