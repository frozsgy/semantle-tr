import pickle
import time

import gensim.models.keyedvectors as word2vec
from tqdm import tqdm


def get_common_words_set():
    result = set()

    with open("tr_50k.txt") as common_words:
        for line in common_words:
            result.add(line.split()[0])
    return result


common_words_set = get_common_words_set()
TOP_N = 1000

t_word2vec = time.process_time()
print("loading word2vec file...")
model = word2vec.KeyedVectors.load_word2vec_format("word2vec/wikipedia-vector.bin", binary=True)
print(f'done in {time.process_time() - t_word2vec} seconds')

hints = {}
with open("static/assets/js/secretWords.js", encoding="utf-8") as secret_words:
    for secret in tqdm(iterable=secret_words.readlines(), desc='generating hints (takes 1~2 minutes to start)'):
        secret = secret.strip()
        if not '"' in secret:
            continue
        secret = secret.strip('",')
        # secret might not be in the model vocabulary if we loaded a subset
        # of the model. Skip generating hints if that's the case
        if secret not in model.key_to_index:
            continue
        # Calculate nearest using KeyedVectors' `most_similar`.
        # It calculates cosine similarity, which is  what
        # the original Semantle does.
        # The first call to `most_similar` is s l o w: the progress
        # indicator will start moving after a minute or so.
        # This is _way_ faster than doing a nested "secret x vocab" loop.
        # Slice up to TOP_N -1 to leave room for the secret word.
        most_similar = [it for it in model.most_similar(secret, topn=100 * TOP_N) if it[0] in common_words_set][
                       0:TOP_N - 1]
        # Nearest must include the secret. `most_similar` doesn't, so we need to add it manually.
        most_similar.extend([(secret, 1)])
        if len(most_similar) < TOP_N:
            raise RuntimeError(
                f'most_similar has too few common words: {len(most_similar)} after filtering, needs {TOP_N}')
        # store-hints.py expects a (score, word) tuple
        nearest = [(item[1], item[0]) for item in most_similar]
        # store-hints.py relies on nearest's order to get the closest, 10th and 1000th nearby element.
        nearest.sort()
        hints[secret] = nearest

with open(b"nearest.pickle", "wb") as pickled:
    pickle.dump(hints, pickled)
