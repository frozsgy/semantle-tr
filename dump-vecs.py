import gensim.models.keyedvectors as word2vec

import sqlite3

model = word2vec.KeyedVectors.load_word2vec_format("../GoogleNews-vectors-negative300.bin", binary=True)

con = sqlite3.connect('word2vec.db')
cur = con.cursor()
cur.execute("""create table if not exists word2vec (word text, vec blob)""")
con.commit()
cur.execute("""create unique index if not exists word2vec_word on word2vec (word)""");
con.commit()

import pdb;pdb.set_trace()

for i, word in enumerate(model.vocab):
    if (i % 1111 == 0):
        con.commit()
    vec = model[word].tostring()
    cur.execute("insert into word2vec values(?,?)", (word,vec))

con.commit()
