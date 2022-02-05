from flask import Flask, request, jsonify, send_file, send_from_directory
import struct
import sqlite3

app = Flask(__name__)

@app.route('/')
def send_index():
    return send_file('static/index.html' )

@app.route('/assets/<path:path>')
def send_static(path):
    return send_from_directory('static/assets', path)

@app.route('/model/<string:word>')
def word(word):
    try:
        con = sqlite3.connect('word2vec.db')
        cur = con.cursor()
        res = cur.execute("SELECT vec FROM word2vec WHERE word = ?", (word,))
        res = list(cur.fetchone())
        con.close()
        if not res:
            return ""
        res = res[0]
        return jsonify(list(struct.unpack('300f', res)))
    except Exception as e:
        print(e)
        return jsonify(e)

@app.route('/model2/<string:secret>/<string:word>')
def model2(secret, word):
    try:
        con = sqlite3.connect('word2vec.db')
        cur = con.cursor()
        res = cur.execute("SELECT vec, percentile FROM word2vec left outer join nearby on nearby.word=? and nearby.neighbor=? WHERE word2vec.word = ?", (secret, word, word))
        row = cur.fetchone()
        if row:
            row = list(row)
        con.close()
        if not row:
            return ""
        vec = row[0]
        result = {
            'vec' : list(struct.unpack('300f', vec))
        }
        if row[1]:
            result['percentile'] = row[1]
        return jsonify(result)
    except Exception as e:
        print(e)
        return jsonify(e)

@app.route('/similarity/<string:word>')
def similarity(word):
    try:
        con = sqlite3.connect('word2vec.db')
        cur = con.cursor()
        res = cur.execute("SELECT top, top10, rest FROM similarity_range WHERE word = ?", (word,))
        res = list(cur.fetchone())
        con.close()
        if not res:
            return ""
        return jsonify({'top': res[0],
                        'top10': res[1],
                        'rest': res[2]})
    except Exception as e:
        print(e)
        return jsonify(e)


@app.errorhandler(404)
def not_found(error):
    return "page not found"

@app.errorhandler(500)
def error_handler(error):
    return error

if __name__ == '__main__':
    import sqlite3
    app.run(host="0.0.0.0", port=5000)
