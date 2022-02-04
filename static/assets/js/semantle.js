let Semantle = (function() {
    'use strict';

    let secret = "";
    let secretVec = null;
    let gameOver = false;
    let firstGuess = true;
    let guesses = [];
    let guessed = new Set();
    let guessCount = 0;
    let model = null;
    const now = Date.now();
    const today = Math.floor(now / 86400000);
    const initialDay = 19021;
    const puzzleNumber = (today - initialDay) % secretWords.length;

    function mag(a) {
        return Math.sqrt(a.reduce(function(sum, val) {
            return sum + val * val;
        }, 0));
    }

    function getCosSim(f1, f2) {
        return Math.abs(f1.reduce(function(sum, a, idx) {
            return sum + a*f2[idx];
        }, 0)/(mag(f1)*mag(f2)));
    }

    async function getModel(word) {
        const url = "/model/" + word.replaceAll(" ", "_");
        const response = await fetch(url);
        try {
            return await response.json();
        } catch (e) {
            return null;
        }
    }

    function init() {
        secret = secretWords[puzzleNumber].toLowerCase();

        $('#give-up-btn').addEventListener('click', function(event) {
            if (!gameOver) {
                if (confirm("Are you sure you want to give up?")) {
                    endGame(0);
                }
            }
        });

        $('#form').addEventListener('submit', async function(event) {
            event.preventDefault();
            if (secretVec === null) {
                secretVec = await getModel(secret);
            }
            $('#error').innerHTML = "";
            const guess = $('#guess').value.trim().replace("!", "").replace("*", "");
            $('#guess').value = "";

            let guessVec = await getModel(guess);

            if (!guessVec) {
                $('#error').innerHTML = `I don't know the word ${guess}.`;
                return false;
            }

            let similarity = getCosSim(guessVec, secretVec) * 100.0;
            let newEntry = [similarity, guess];
            if (!guessed.has(guess)) {
                guessed.add(guess);
                guesses.push(newEntry);
                guessCount += 1;
            }
            guesses.sort(function(a, b){return b[0]-a[0]});
            if (!gameOver) {
                setCookie(-1);
            }
            updateGuesses(guess);

            firstGuess = false;
            if (guess.toLowerCase() === secret && !gameOver) {
                endGame(guesses.length);
            }
            return false;
        });

        document.cookie="gameOver=0;expires=Thu, 01 Jan 1970 00:00:01 GMT;SameSite=Strict";
        const cookie = document.cookie;
        if (cookie) {
            let parts = cookie.split("=");
            parts = parts[1].split(",");
            const puzzle = parseInt(parts[0]);
            const outcome = parseInt(parts[1]);
            if (puzzle === puzzleNumber) {
                if (outcome >= 0) {
                    endGame(outcome);
                }
                if (parts.length > 1) {
                    const soFar = parts[2].split("!");
                    for (let word of soFar) {
                        let parts = word.split("*");
                        let similarity = parseFloat(parts[0]);
                        if (similarity === 0) {
                            continue;
                        }
                        word = parts[1];
                        guesses.push([similarity, word]);
                        guessed.add(word);
                        guessCount += 1;
                    }
                    updateGuesses(null);
                }
                if (parts.length > 2) {
                    guessCount = parseInt(parts[3]);
                }
            }
        }
    }

    function updateGuesses(guess) {
        let inner = `<tr><th>Guess</th><th>Similarity</th></tr>`;
        for (let entry of guesses) {
            let oldGuess = entry[1];
            let similarity = entry[0];
            let color;
            if (oldGuess === guess) {
                color = '#cc00cc';
            } else {
                color = '#000000';
            }
            inner += `<tr><td style="color:${color}">${oldGuess}</td><td>${similarity.toFixed(2)}</td>`;
        }
        $('#guesses').innerHTML = inner;
    }

    function setCookie(winState) {
        let cookie = `s=${puzzleNumber},${winState},`;
        let gc = `,${guessCount}`;
        let cookieTrailer = ";SameSite=strict";
        for (const guess of guesses) {
            let similarity = guess[0];
            let word = guess[1];
            if (cookie.length + word.length + cookieTrailer.length + gc.length >= 4085) {
                break;
            }
            cookie += similarity + "*" + word + "!";
        }
        if (guesses.length == 0) {
            cookie += "0*placeholder!"
        }
        document.cookie = cookie.substring(0, cookie.length - 1) + gc + cookieTrailer;
    }

    function endGame(guessCount) {
        gameOver = true;
        if (guessCount > 0) {
            $('#response').innerHTML = `<b>You found it in ${guessCount}!  The secret word is ${secret}</b>.  Feel free to keep entering words if you are curious about the similarity to other words. <a href="javascript:navigator.clipboard.writeText('I solved Semantle #${puzzleNumber} in ${guessCount} guesses.  https://semantle.novalis.org/');alert('Copied results to clipboard');">Share</a> and play again tomorrow.`
        } else {
            $('#response').innerHTML = `<b>You gave up!  The secret word is: ${secret}</b>.  Feel free to keep entering words if you are curious about the similarity to other words.`;
        }
        setCookie(guessCount);
    }

    function $(id) {
        if (id.charAt(0) !== '#') return false;
        return document.getElementById(id.substring(1));
    }

    return {
        init: init
    };
})();
    
window.addEventListener('load', Semantle.init);
