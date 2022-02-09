
function $(id) {
    if (id.charAt(0) !== '#') return false;
    return document.getElementById(id.substring(1));
}

function mag(a) {
    return Math.sqrt(a.reduce(function(sum, val) {
        return sum + val * val;
    }, 0));
}

function dot(f1, f2) {
    return f1.reduce(function(sum, a, idx) {
        return sum + a*f2[idx];
    }, 0);
}

function getCosSim(f1, f2) {
    return Math.abs(dot(f1,f2)/(mag(f1)*mag(f2)));
}


function plus(v1, v2) {
    const out = [];
    for (let i = 0; i < v1.length; i++) {
            out.push(v1[i] + v2[i]);
    }
    return out;
}

function minus(v1, v2) {
    const out = [];
    for (let i = 0; i < v1.length; i++) {
        out.push(v1[i] - v2[i]);
    }
    return out;
}


function scale (v, s) {
    const out = [];
    for (let i = 0; i < v1.length; i++) {
        out.push(v[i] * s);
    }
    return out;
}


function project_along(v1, v2, t) {
    const v = minus(v2, v1);
    const num = dot(minus(t, v1), v);
    const denom = dot(v,v);
    return num/denom;
}

const words_selected = [];
const cache = [];
let secret = "";
let secretVec = null;
let similarityStory = null;

function select(word, secretVec) {
    /*
    let model;
    if (!(word in cache)) {
        // this can happen on a reload, since we do not store
        // the vectors in localstorage
        model = cache[word];
    } else {
        model = getModel(word);
        cache[word] = model;
    }
    words_selected.push([word, model.vec]);
    if (words_selected.length > 2) {
        words_selected.pop();
    }
    const proj = project_along(words_selected[0][1], words_selected[1][1],
                               target);
    console.log(proj);
*/
}

let Semantle = (function() {
    'use strict';

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
    const storage = window.localStorage;

    async function getSimilarityStory(secret) {
        const url = "/similarity/" + secret;
        const response = await fetch(url);
        try {
            return await response.json();
        } catch (e) {
            return null;
        }
    }

    async function getModel(word) {
        if (cache.hasOwnProperty(word)) {
            return cache[word];
        }
        const url = "/model2/" + secret + "/" + word.replaceAll(" ", "_");
        const response = await fetch(url);
        try {
            return await response.json();
        } catch (e) {
            return null;
        }
    }

    async function init() {
        secret = secretWords[puzzleNumber].toLowerCase();

        try {
            similarityStory = await getSimilarityStory(secret);
            $('#similarity-story').innerHTML = `
For today's secret word, the nearest word has a similarity of
<b>${(similarityStory.top * 100).toFixed(2)}</b>, the tenth-nearest has a similarity of
${(similarityStory.top10 * 100).toFixed(2)} and the one thousandth nearest word has a
similarity of ${(similarityStory.rest * 100).toFixed(2)}.
`;
        } catch {
            // we can live without this in the event that something is broken
        }

        const storagePuzzleNumber = storage.getItem("puzzleNumber");
        if (storagePuzzleNumber != puzzleNumber) {
            storage.clear();
            storage.setItem("puzzleNumber", puzzleNumber);
        }

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
                secretVec = (await getModel(secret)).vec;
            }
            $('#error').innerHTML = "";
            const guess = $('#guess').value.trim().replace("!", "").replace("*", "");
            $('#guess').value = "";

            const guessData = await getModel(guess);
            if (!guessData) {
                $('#error').innerHTML = `I don't know the word ${guess}.`;
                return false;
            }

            let percentile = guessData.percentile;

            const guessVec = guessData.vec;

            cache[guess] = guessData;

            let similarity = getCosSim(guessVec, secretVec) * 100.0;
            let newEntry = [similarity, guess, percentile];
            if (!guessed.has(guess)) {
                guessed.add(guess);
                guesses.push(newEntry);
                guessCount += 1;
            }
            guesses.sort(function(a, b){return b[0]-a[0]});
            saveGame(-1);

            updateGuesses(guess);

            firstGuess = false;
            if (guess.toLowerCase() === secret && !gameOver) {
                endGame(guesses.length);
            }
            return false;
        });

        const winState = storage.getItem("winState");
        if (winState != null) {
            guesses = JSON.parse(storage.getItem("guesses"));
            for (let guess of guesses) {
                guessed.add(guess[1]);
            }
            updateGuesses("");
            if (winState != -1) {
                endGame(winState);
            }
        }
    }

    function updateGuesses(guess) {
        let inner = `<tr><th>Guess</th><th>Similarity</th><th>Getting close?</th></tr>`;
        for (let entry of guesses) {
            let oldGuess = entry[1];
            let similarity = entry[0];
            let percentileText = "(cold)";
            let percentile = entry[2];
            let progress = "";
            let cls = "";
            if (similarity >= similarityStory.rest * 100) {
                percentileText = '<abbr title="Unusual word found!  This word is not in the list of &quot;normal&quot; words that we use for the top-1000 list, but it is still similar!">????</abbr>';
            }
            if (percentile) {
                if (percentile == 1000) {
                    percentileText = "FOUND!";
                } else {
                    cls="close";
                    percentileText = `${percentile}/1000 &nbsp;`;
                    progress = ` <span style="display:inline-block;width:10em;height:1ex; padding-bottom:1ex; background-color:#eeeeee;">
<span style="background-color:#008000; width:${percentile/10}%; display:inline-block">&nbsp;</span>
</span>`;
                }
            }
            let color;
            if (oldGuess === guess) {
                color = '#cc00cc';
            } else {
                color = '#000000';
            }
            inner += `<tr><td style="color:${color}" onclick="select('${oldGuess}', secretVec);">${oldGuess}</td><td>${similarity.toFixed(2)}</td><td class="${cls}">${percentileText}${progress}
</td></tr>`;
        }
        $('#guesses').innerHTML = inner;
    }


    function saveGame(winState) {
        let oldState = storage.getItem("winState");
        if (oldState == -1 || oldState == null) {
            storage.setItem("winState", winState);
            storage.setItem("guesses", JSON.stringify(guesses));
        }
    }

    function endGame(guessCount) {
        $('#give-up-btn').style="display:none;";
        $('#response').classList.add("gaveup");
        gameOver = true;
        if (guessCount > 0) {
            $('#response').innerHTML = `<b>You found it in ${guessCount}!  The secret word is ${secret}</b>.  Feel free to keep entering words if you are curious about the similarity to other words. <a href="javascript:navigator.clipboard.writeText('I solved Semantle #${puzzleNumber} in ${guessCount} guesses.  https://semantle.novalis.org/');alert('Copied results to clipboard');">Share</a> and play again tomorrow.`
        } else {
            $('#response').innerHTML = `<b>You gave up!  The secret word is: ${secret}</b>.  Feel free to keep entering words if you are curious about the similarity to other words.`;
        }
        saveGame(guessCount);
    }

    return {
        init: init
    };
})();
    
window.addEventListener('load', async () => { Semantle.init() });
