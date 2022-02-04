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
        res = cur.fetchone()
        if not res:
            return ""
        res = res[0]
        con.close()
        return jsonify(list(struct.unpack('300f', res)))
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
