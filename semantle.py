from flask import (
    Flask,
    request,
    jsonify,
    send_file,
    send_from_directory,
    render_template,
)
import struct
import sqlite3
import base64
from functools import lru_cache

app = Flask(__name__)


@app.route("/")
def send_index():
    return send_file("static/index.html")


@app.route("/favicon.ico")
def send_favicon():
    return send_file("static/assets/favicon.ico")


@app.route("/assets/<path:path>")
def send_static(path):
    return send_from_directory("static/assets", path)


def expand_bfloat(vec, half_length=600):
    """
    expand truncated float32 to float32
    """
    if len(vec) == half_length:
        vec = b"".join((b"\00\00" + bytes(pair)) for pair in zip(vec[::2], vec[1::2]))
    return vec


@app.route("/model/<string:word>")
def word(word):
    try:
        con = sqlite3.connect("word2vec.db")
        cur = con.cursor()
        res = cur.execute("SELECT vec FROM word2vec WHERE word = ?", (word,))
        res = list(cur.fetchone())
        con.close()
        if not res:
            return ""
        res = res[0]
        return jsonify(list(struct.unpack("300f", expand_bfloat(res))))
    except Exception as e:
        print(e)
        return jsonify(e)


@lru_cache(maxsize=50000)
def get_model2(secret, word):
    con = sqlite3.connect("word2vec.db")
    cur = con.cursor()
    res = cur.execute(
        "SELECT vec, percentile FROM word2vec left outer join nearby on nearby.word=? and nearby.neighbor=? WHERE word2vec.word = ?",
        (secret, word, word),
    )
    row = cur.fetchone()
    if row:
        row = list(row)
    con.close()
    if not row:
        return ""
    vec = row[0]
    result = {"vec": list(struct.unpack("300f", expand_bfloat(vec)))}
    if row[1]:
        result["percentile"] = row[1]
    return jsonify(result)


@app.route("/model2/<string:secret>/<string:word>")
def model2(secret, word):
    try:
        return get_model2(secret, word)
    except Exception as e:
        print(e)
        return jsonify(e)


@app.route("/similarity/<string:word>")
def similarity(word):
    try:
        con = sqlite3.connect("word2vec.db")
        cur = con.cursor()
        res = cur.execute(
            "SELECT top, top10, rest FROM similarity_range WHERE word = ?", (word,)
        )
        res = list(cur.fetchone())
        con.close()
        if not res:
            return ""
        return jsonify({"top": res[0], "top10": res[1], "rest": res[2]})
    except Exception as e:
        print(e)
        return jsonify(e)


@app.route("/nearby/<string:word>")
def nearby(word):
    try:
        con = sqlite3.connect("word2vec.db")
        cur = con.cursor()
        res = cur.execute(
            "SELECT neighbor FROM nearby WHERE word = ? order by percentile desc limit 10 offset 1",
            (word,),
        )
        rows = cur.fetchall()
        con.close()
        if not rows:
            return ""
        return jsonify([row[0] for row in rows])
    except Exception as e:
        print(e)
        return jsonify(e)


@app.route("/nearby_1k/<string:word_b64>")
def nearby_1k(word_b64):
    try:
        word = base64.b64decode(word_b64).decode("utf-8")

        con = sqlite3.connect("word2vec.db")
        cur = con.cursor()
        res = cur.execute(
            "SELECT neighbor, percentile, similarity FROM nearby WHERE word = ? order by percentile desc limit 1000 offset 1 ",
            (word,),
        )
        rows = cur.fetchall()
        con.close()
        words = [
            dict(
                neighbor=row[0],
                percentile=int(row[1]),
                similarity="%0.2f" % (100 * row[2]),
            )
            for row in rows
        ]
        return render_template("top1k.html", word=word, words=words)

    except Exception as e:
        import traceback

        traceback.print_exc()
        return "Oops, error"


@app.errorhandler(404)
def not_found(error):
    return "page not found"


@app.errorhandler(500)
def error_handler(error):
    return error


@app.after_request
def add_header(response):
    response.headers["Cache-Control"] = "no-store"
    return response


if __name__ == "__main__":
    import sqlite3

    app.run(host="0.0.0.0", port=5000)
