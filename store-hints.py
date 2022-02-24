import sqlite3

import pickle

from more_itertools import chunked
import tqdm

con = sqlite3.connect("word2vec.db")
con.execute("PRAGMA journal_mode=WAL")
cur = con.cursor()
cur.execute(
    """create table if not exists nearby 
    (word text, neighbor text, similarity float, percentile integer, 
    PRIMARY KEY (word, neighbor))"""
)

cur.execute(
    """create table if not exists similarity_range
    (word text PRIMARY KEY, top float, top10 float, rest float)"""
)
con.commit()


with open(b"nearest.pickle", "rb") as f:
    nearest = pickle.load(f)

CHUNK_SIZE = 1111
with con:
    con.execute("DELETE FROM nearby")
    con.execute("DELETE FROM similarity_range")
    for secret, neighbors in tqdm.tqdm(nearest.items()):
        con.executemany(
            "insert into nearby (word, neighbor, similarity, percentile) values (?, ?, ?, ?)",
            (
                (secret, neighbor, "%s" % score, (1 + idx))
                for idx, (score, neighbor) in enumerate(neighbors)
            ),
        )

        top = neighbors[-2][0]
        top10 = neighbors[-12][0]
        rest = neighbors[0][0]
        con.execute(
            "insert into similarity_range (word, top, top10, rest) values (?, ?, ?, ?)",
            (secret, "%s" % top, "%s" % top10, "%s" % rest),
        )

con.commit()
