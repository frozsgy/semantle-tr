So, this is sort of hacked together from a lot of data sources and the
code is a mess.  Here's a hello world of how to get up and running.

First, you'll need to create the sqlite db for the main vectors.  So
get GoogleNews-vectors-negative300.bin from
[here](https://code.google.com/archive/p/word2vec/) and run
`dump-vecs.py`.

Next, the hints: `dump-hints.py` to create a pickle, then
`store-hints.py` to import into the db.

Next, figure out which British words have been respelled in word2vec,
using `british.py`, so that we can respell them for users. They
come from [here](https://github.com/hyperreality/American-British-English-Translator).

`python semantle.py` to run the web server.

Formatting
==========

`black .` to reformat all Python files
