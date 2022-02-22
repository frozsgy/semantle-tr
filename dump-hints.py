import gensim.models.keyedvectors as word2vec

import math

import heapq

from numpy import dot
from numpy.linalg import norm

import re
import time

import code, traceback, signal


def debug(sig, frame):
    """Interrupt running process, and provide a python prompt for
    interactive debugging."""
    d = {"_frame": frame}  # Allow access to frame object.
    d.update(frame.f_globals)  # Unless shadowed by global
    d.update(frame.f_locals)

    i = code.InteractiveConsole(d)
    message = "Signal received : entering python shell.\nTraceback:\n"
    message += "".join(traceback.format_stack(frame))
    i.interact(message)


signal.signal(signal.SIGUSR1, debug)  # Register handler


model = word2vec.KeyedVectors.load_word2vec_format(
    "../GoogleNews-vectors-negative300.bin", binary=True
)

print("loaded model...")


def mag(v):
    return math.sqrt(sum(x * x for x in v))


def similarity(v1, v2):
    return abs(sum(a * b for a, b in zip(v1, v2)) / (mag(v1) * mag(v2)))


def similarity(a, b):
    return abs(dot(a, b) / (norm(a) * norm(b)))


# synonyms = {}

# with open("moby/words.txt") as moby:
#     for line in moby.readlines():
#         line = line.strip()
#         words = line.split(",")
#         word = words[0]
#         synonyms[word] = set(words)

print("loaded moby...")

allowable_words = set()
with open("words_alpha.txt") as walpha:
    for line in walpha.readlines():
        allowable_words.add(line.strip())

print("loaded alpha...")

simple_word = re.compile("^[a-z]*")
words = []
for word in model.vocab:
    #    if simple_word.match(word) and word in allowable_words:
    words.append(word)

hints = {}
with open("static/assets/js/secretWords.js") as f:
    for line in f.readlines():
        line = line.strip()
        if not '"' in line:
            continue
        secret = line.strip('",')
        target_vec = model[secret]

        start = time.time()
        #        syns = synonyms.get(secret) or []
        nearest = []
        for i, word in enumerate(words):
            #            if word in syns:
            #                continue
            #            if secret in (synonyms.get(word) or []):
            #                # yow, asymmetrical!
            #                continue
            #            if word in secret or secret in word:
            #                continue
            vec = model[word]
            s = similarity(vec, target_vec)
            heapq.heappush(nearest, (s, word))
            if len(nearest) > 1000:
                heapq.heappop(nearest)
        nearest.sort()
        hints[secret] = nearest

import pickle

with open(b"nearest.pickle", "wb") as f:
    pickle.dump(hints, f)
