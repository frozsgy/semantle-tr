#!/bin/sh
wget -c https://dumps.wikimedia.org/trwiki/latest/trwiki-latest-pages-articles.xml.bz2
python train.py