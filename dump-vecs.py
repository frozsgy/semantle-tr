import collections.abc
import sqlite3

import gensim.models.keyedvectors as word2vec
import numpy as np
import tqdm
from more_itertools import chunked

collections.Mapping = collections.abc.Mapping

model = word2vec.KeyedVectors.load_word2vec_format("word2vec/wikipedia-vector.bin", binary=True)

con = sqlite3.connect("word2vec.db")
con.execute("PRAGMA journal_mode=WAL")
cur = con.cursor()
cur.execute("""create table if not exists word2vec (word text PRIMARY KEY, vec blob)""")
con.commit()


def bfloat(vec):
    """
    Half of each floating point vector happens to be zero in the Google model.
    Possibly using truncated float32 = bfloat. Discard to save space.
    """
    vec.dtype = np.int16
    return vec[1::2].tobytes()


CHUNK_SIZE = 1111
con.execute("DELETE FROM word2vec")
for words in chunked(tqdm.tqdm(model.key_to_index), CHUNK_SIZE):
    with con:
        con.executemany(
            "insert into word2vec values(?,?)",
            ((word, bfloat(model[word])) for word in words),
        )
