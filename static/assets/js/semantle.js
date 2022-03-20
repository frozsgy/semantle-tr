/*
    Copyright (c) 2022, David Turner <novalis@novalis.org>

     This program is free software: you can redistribute it and/or modify it under the terms of the GNU General Public License as published by the Free Software Foundation, version 3.

    This program is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the GNU General Public License for more details.

    You should have received a copy of the GNU General Public License along with this program. If not, see <https://www.gnu.org/licenses/>.
*/
'use strict';

let gameOver = false;
let firstGuess = true;
let guesses = [];
let latestGuess = undefined;
let guessed = new Set();
let guessCount = 0;
let model = null;
const now = Date.now() + 10800000;
const today = Math.floor(now / 86400000);
const initialDay = 19070;
const puzzleNumber = (today - initialDay) % secretWords.length;
const yesterdayPuzzleNumber = (today - initialDay + secretWords.length - 1) % secretWords.length;
const storage = window.localStorage;
let caps = 0;
let warnedCaps = 0;
let chrono_forward = 1;
let darkModeMql = window.matchMedia('(prefers-color-scheme: dark)');
let darkMode = false;

function $(q) {
    return document.querySelector(q);
}

function mag(a) {
    return Math.sqrt(a.reduce(function (sum, val) {
        return sum + val * val;
    }, 0));
}

function dot(f1, f2) {
    return f1.reduce(function (sum, a, idx) {
        return sum + a * f2[idx];
    }, 0);
}

function getCosSim(f1, f2) {
    return dot(f1, f2) / (mag(f1) * mag(f2));
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


function scale(v, s) {
    const out = [];
    for (let i = 0; i < v.length; i++) {
        out.push(v[i] * s);
    }
    return out;
}


function project_along(v1, v2, t) {
    const v = minus(v2, v1);
    const num = dot(minus(t, v1), v);
    const denom = dot(v, v);
    return num / denom;
}

function share() {
    // We use the stored guesses here, because those are not updated again
    // once you win -- we don't want to include post-win guesses here.
    const text = solveStory(JSON.parse(storage.getItem("guesses")), puzzleNumber);
    const copied = ClipboardJS.copy(text);

    if (copied) {
        alert("Panoya kopyalandı");
    } else {
        alert("Panoya kopyalama başarısız oldu");
    }
}

const words_selected = [];
const cache = {};
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

function guessRow(similarity, oldGuess, percentile, guessNumber, guess) {
    let percentileText = "(soğuk)";
    let progress = "";
    let cls = "";
    if (similarity >= similarityStory.rest * 100) {
        percentileText = '<span class="weirdWord">????<span class="tooltiptext">Alışılmışın dışında sözcük bulundu! Bu sözcük yakın sözcükler için kullandığımız listede olmamasına rağmen yine de ilişkili! (Bir kısaltma ya da özel isim olabilir mi?)</span></span>';
    }
    if (percentile) {
        if (percentile == 1000) {
            percentileText = "BULUNDU!";
        } else {
            cls = "close";
            percentileText = `<span class="percentile">${percentile}/1000</span>&nbsp;`;
            progress = ` <span class="progress-container">
<span class="progress-bar" style="width:${percentile / 10}%">&nbsp;</span>
</span>`;
        }
    }
    let color;
    if (oldGuess === guess) {
        color = '#c0c';
    } else if (darkMode) {
        color = '#fafafa';
    } else {
        color = '#000';
    }
    const similarityLevel = similarity * 2.55;
    let similarityColor;
    if (darkMode) {
        similarityColor = `255,${255 - similarityLevel},${255 - similarityLevel}`;
    } else {
        similarityColor = `${similarityLevel},0,0`;
    }
    return `<tr><td>${guessNumber}</td><td style="color:${color}" onclick="select('${oldGuess}', secretVec);">${oldGuess}</td><td style="color: rgb(${similarityColor})">${similarity.toFixed(2)}</td><td class="${cls}">${percentileText}${progress}
</td></tr>`;

}

function updateLocalTime() {
    const now = new Date();
    now.setUTCHours(21, 0, 0, 0);

    $('#localtime').innerHTML = ` ${now.getHours()}:00'a karşılık geliyor`;
}

function solveStory(guesses, puzzleNumber) {
    const guess_count = guesses.length;
    if (guess_count == 0) {
        return `Semantle Türkçe ${puzzleNumber} numaralı bulmacada tek bir tahminde bile bulunmadan pes ettim.`;
    }

    if (guess_count == 1) {
        return `Semantle Türkçe ${puzzleNumber} numaralı bulmacayı ilk tahminimde çözdüm!`;
    }

    let describe = function (similarity, percentile) {
        let out = `${similarity.toFixed(2)} idi`;
        if (percentile) {
            out += ` (${percentile}/1000)`;
        }
        return out;
    }

    const guesses_chrono = guesses.slice();
    guesses_chrono.sort(function (a, b) {
        return a[3] - b[3]
    });

    let [similarity, old_guess, percentile, guess_number] = guesses_chrono[0];
    let first_guess = `İlk tahminimin benzerlik skoru ${describe(similarity, percentile)}. `;
    let first_guess_in_top = !!percentile;

    let first_hit = '';
    if (!first_guess_in_top) {
        for (let entry of guesses_chrono) {
            [similarity, old_guess, percentile, guess_number] = entry;
            if (percentile) {
                first_hit = `En yakın 1000'e girebilen ilk tahminim ${guess_number}. tahminimdi. `;
                break;
            }
        }
    }

    const penultimate_guess = guesses_chrono[guesses_chrono.length - 2];
    [similarity, old_guess, percentile, guess_number] = penultimate_guess;
    const penultimate_guess_msg = `Sondan bir önceki tahminimin benzerlik skoru ise ${describe(similarity, percentile)}. `;

    return `Semantle Türkçe ${puzzleNumber} numaralı bulmacayı ${guess_count} tahminde çözdüm. ${first_guess}${first_hit}${penultimate_guess_msg}http://semantle.ozanalpay.com/`;
}

let Semantle = (function () {
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
        const url = "/model2/" + secret + "/" + word.replace(/\ /gi, "_");
        const response = await fetch(url);
        try {
            return await response.json();
        } catch (e) {
            return null;
        }
    }

    async function getNearby(word) {
        const url = "/nearby/" + word;
        const response = await fetch(url);
        try {
            return await response.json();
        } catch (e) {
            return null;
        }
    }

    async function init() {
        secret = secretWords[puzzleNumber].toLowerCase();
        const yesterday = secretWords[yesterdayPuzzleNumber].toLowerCase();

        $('#yesterday').innerHTML = `Dünün sözcüğü: <b>"${yesterday}"</b>.`;
        $('#yesterday2').innerHTML = yesterday;

        $('#lower').checked = storage.getItem("lower") == "true";

        $('#lower').onchange = (e) => {
            storage.setItem("lower", "" + $('#lower').checked);
        };

        try {
            const yesterdayNearby = await getNearby(yesterday);
            const secretBase64 = btoa(unescape(encodeURIComponent(yesterday)));
            $('#nearbyYesterday').innerHTML = `Azalan yakınlık sırasına göre: ${yesterdayNearby.join(", ")}. <a href="nearby_1k?word=${secretBase64}">Devamını Gör</a>`;
        } catch (e) {
            $('#nearbyYesterday').innerHTML = `Yakında!`;
        }
        updateLocalTime();

        try {
            similarityStory = await getSimilarityStory(secret);
            $('#similarity-story').innerHTML = `Bugünün oyun numarası <b>${puzzleNumber}</b>. En yakın sözcüğün benzerlik skoru <b>${(similarityStory.top * 100).toFixed(2)}</b>, en yakın onuncu sözcüğün yakınlık skoru ${(similarityStory.top10 * 100).toFixed(2)}, ve en yakın bininci sözcüğün yakınlık skoru ise ${(similarityStory.rest * 100).toFixed(2)}.`;
        } catch {
            // we can live without this in the event that something is broken
        }

        const storagePuzzleNumber = storage.getItem("puzzleNumber");
        if (storagePuzzleNumber != puzzleNumber) {
            storage.removeItem("guesses");
            storage.removeItem("winState");
            storage.setItem("puzzleNumber", puzzleNumber);
        }

        document.querySelectorAll(".dialog-close").forEach((el) => {
            el.innerHTML = ""
            el.appendChild($("#x-icon").content.cloneNode(true));
        });

        if (!storage.getItem("readRules")) {
            openRules();
        }

        $("#rules-button").addEventListener('click', openRules);
        $("#settings-button").addEventListener('click', openSettings);

        document.querySelectorAll(".dialog-underlay, .dialog-close, #capitalized-link").forEach((el) => {
            el.addEventListener('click', () => {
                document.body.classList.remove('dialog-open', 'rules-open', 'settings-open');
            });
        });

        document.querySelectorAll(".dialog").forEach((el) => {
            el.addEventListener("click", (event) => {
                // prevents click from propagating to the underlay, which closes the rules
                event.stopPropagation();
            });
        });

        $("#dark-mode").addEventListener('click', function (event) {
            storage.setItem("prefersDarkColorScheme", event.target.checked);
            darkModeMql.onchange = null;
            darkMode = event.target.checked;
            toggleDarkMode(darkMode);
            updateGuesses();
        });

        toggleDarkMode(darkMode);

        if (storage.getItem("prefersDarkColorScheme") === null) {
            $("#dark-mode").checked = false;
            $("#dark-mode").indeterminate = true;
        }

        $('#give-up-btn').addEventListener('click', function (event) {
            if (!gameOver) {
                if (confirm("Pes etmek istediğinize emin misiniz?")) {
                    endGame(false, true);
                }
            }
        });

        $('#form').addEventListener('submit', async function (event) {
            event.preventDefault();
            if (secretVec === null) {
                secretVec = (await getModel(secret)).vec;
            }
            $('#guess').focus();
            $('#error').textContent = "";
            let guess = $('#guess').value.trim().replace("!", "").replace("*", "");
            if (!guess) {
                return false;
            }
            if ($("#lower").checked) {
                guess = guess.toLowerCase();
            }

            if (guess[0].toLowerCase() != guess[0]) {
                caps += 1;
            }
            if (caps >= 2 && (caps / guesses.length) > 0.4 && !warnedCaps) {
                warnedCaps = true;
                $("#lower").checked = confirm("Girdiğiniz sözcüklerin ilk harfleri büyük gözüküyor. Bu bazı kelimelerde sorunlara yol açabiliyor, bunu otomatik olarak düzeltmemi ister misiniz?");
                storage.setItem("lower", "true");
            }

            $('#guess').value = "";

            const guessData = await getModel(guess);
            if (!guessData) {
                $('#error').textContent = `${guess} diye bir sözcük veritabanımda kayıtlı değil.`;
                return false;
            }

            let percentile = guessData.percentile;

            const guessVec = guessData.vec;

            cache[guess] = guessData;

            let similarity = getCosSim(guessVec, secretVec) * 100.0;
            if (!guessed.has(guess)) {
                if (!gameOver) {
                    guessCount += 1;
                }
                guessed.add(guess);

                const newEntry = [similarity, guess, percentile, guessCount];
                guesses.push(newEntry);

                const stats = getStats();
                if (!gameOver) {
                    stats['totalGuesses'] += 1;
                }
                storage.setItem('stats', JSON.stringify(stats));
            }
            guesses.sort(function (a, b) {
                return b[0] - a[0]
            });

            if (!gameOver) {
                saveGame(-1, -1);
            }

            chrono_forward = 1;

            latestGuess = guess;
            updateGuesses();

            firstGuess = false;
            if (guess.toLowerCase() === secret && !gameOver) {
                endGame(true, true);
            }
            return false;
        });

        const winState = storage.getItem("winState");
        if (winState != null) {
            guesses = JSON.parse(storage.getItem("guesses"));
            for (let guess of guesses) {
                guessed.add(guess[1]);
            }
            guessCount = guessed.size;
            latestGuess = "";
            updateGuesses();
            if (winState != -1) {
                endGame(winState > 0, false);
            }
        }
    }

    function openRules() {
        document.body.classList.add('dialog-open', 'rules-open');
        storage.setItem("readRules", true);
        $("#rules-close").focus();
    }

    function openSettings() {
        document.body.classList.add('dialog-open', 'settings-open');
        $("#settings-close").focus();
    }

    function updateGuesses() {
        let inner = `<tr><th id="chronoOrder">#</th><th id="alphaOrder">Tahmin</th><th id="similarityOrder">Benzerlik</th><th>Yakın mı?</th></tr>`;
        /* This is dumb: first we find the most-recent word, and put
           it at the top.  Then we do the rest. */
        for (let entry of guesses) {
            let [similarity, oldGuess, percentile, guessNumber] = entry;
            if (oldGuess == latestGuess) {
                inner += guessRow(similarity, oldGuess, percentile, guessNumber, latestGuess);
            }
        }
        inner += "<tr><td colspan=4><hr></td></tr>";
        for (let entry of guesses) {
            let [similarity, oldGuess, percentile, guessNumber] = entry;
            if (oldGuess != latestGuess) {
                inner += guessRow(similarity, oldGuess, percentile, guessNumber);
            }
        }
        $('#guesses').innerHTML = inner;
        $('#chronoOrder').addEventListener('click', event => {
            guesses.sort(function (a, b) {
                return chrono_forward * (a[3] - b[3])
            });
            chrono_forward *= -1;
            updateGuesses();
        });
        $('#alphaOrder').addEventListener('click', event => {
            guesses.sort(function (a, b) {
                return a[1].localeCompare(b[1])
            });
            chrono_forward = 1;
            updateGuesses();
        });
        $('#similarityOrder').addEventListener('click', event => {
            guesses.sort(function (a, b) {
                return b[0] - a[0]
            });
            chrono_forward = 1;
            updateGuesses();
        });
    }

    function toggleDarkMode(on) {
        document.body.classList[on ? 'add' : 'remove']('dark');
        const darkModeCheckbox = $("#dark-mode");
        // this runs before the DOM is ready, so we need to check
        if (darkModeCheckbox) {
            darkModeCheckbox.checked = on;
        }
    }

    function checkMedia() {
        const storagePrefersDarkColorScheme = storage.getItem("prefersDarkColorScheme");
        if (storagePrefersDarkColorScheme === 'true' || storagePrefersDarkColorScheme === 'false') {
            darkMode = storagePrefersDarkColorScheme === 'true';
        } else {
            darkMode = darkModeMql.matches;
            darkModeMql.onchange = (e) => {
                darkMode = e.matches;
                toggleDarkMode(darkMode)
                updateGuesses();
            }
        }
        toggleDarkMode(darkMode);
    }

    function saveGame(guessCount, winState) {
        // If we are in a tab still open from yesterday, we're done here.
        // Don't save anything because we may overwrite today's game!
        let savedPuzzleNumber = storage.getItem("puzzleNumber");
        if (savedPuzzleNumber != puzzleNumber) {
            return
        }

        storage.setItem("winState", winState);
        storage.setItem("guesses", JSON.stringify(guesses));
    }

    function getStats() {
        const oldStats = storage.getItem("stats");
        if (oldStats == null) {
            const stats = {
                'firstPlay': puzzleNumber,
                'lastEnd': puzzleNumber - 1,
                'lastPlay': puzzleNumber,
                'winStreak': 0,
                'playStreak': 0,
                'totalGuesses': 0,
                'wins': 0,
                'giveups': 0,
                'abandons': 0,
                'totalPlays': 0,
            };
            storage.setItem("stats", JSON.stringify(stats));
            return stats;
        } else {
            const stats = JSON.parse(oldStats);
            if (stats['lastPlay'] != puzzleNumber) {
                const onStreak = (stats['lastPlay'] == puzzleNumber - 1);
                if (onStreak) {
                    stats['playStreak'] += 1;
                }
                stats['totalPlays'] += 1;
                if (stats['lastEnd'] != puzzleNumber - 1) {
                    stats['abandons'] += 1;
                }
                stats['lastPlay'] = puzzleNumber;
            }
            return stats;
        }
    }

    function endGame(won, countStats) {
        let stats;

        stats = getStats();
        if (countStats) {
            const onStreak = (stats['lastEnd'] == puzzleNumber - 1);

            stats['lastEnd'] = puzzleNumber;
            if (won) {
                if (onStreak) {
                    stats['winStreak'] += 1;
                } else {
                    stats['winStreak'] = 1;
                }
                stats['wins'] += 1;
            } else {
                stats['winStreak'] = 0;
                stats['giveups'] += 1;
            }
            storage.setItem("stats", JSON.stringify(stats));
        }

        $('#give-up-btn').style = "display:none;";
        $('#response').classList.add("gaveup");
        gameOver = true;
        const secretBase64 = btoa(unescape(encodeURIComponent(secret)));
        let response;
        if (won) {
            response = `<p><b>${guesses.length}. tahminde günün sözcüğünü (${secret}) buldun!</b>. Eğer başka sözcüklerle olan benzerliği merak ediyorsan, kelime girmeye devam edebilirsin. Sonuçlarını paylaşmak istersen <a href="javascript:share();">buraya</a> tıklayabilirsin. Bugünün sözcüğüne en yakın sözcükleri görmek istersen <a href="nearby_1k?word=${secretBase64}">buraya</a> tıklayabilirsin. Yarın görüşmek üzere! </p>`
        } else {
            response = `<p><b>Pes ettin! Günün sözcüğü ${secret}</b>. Eğer başka sözcüklerle olan benzerliği merak ediyorsan, kelime girmeye devam edebilirsin. Bugünün sözcüğüne en yakın sözcükleri görmek istersen <a href="nearby_1k?word=${secretBase64}">buraya</a> tıklayabilirsin. Yarın görüşmek üzere! </p>`;
        }

        const totalGames = stats['wins'] + stats['giveups'] + stats['abandons'];
        response += `<br/>
İstatistikler: <br/>
<table>
<tr><th>İlk oyun:</th><td>${stats['firstPlay']}</td></tr>
<tr><th>Oynanan gün sayısı: </th><td>${totalGames}</td></tr>
<tr><th>Kazanılan oyun sayısı:</th><td>${stats['wins']}</td></tr>
<tr><th>Aralıksız kazanılan oyun sayısı:</th><td>${stats['winStreak']}</td></tr>
<tr><th>Pes edilen oyun sayısı:</th><td>${stats['giveups']}</td></tr>
<tr><th>Bitirilmeyen oyun sayısı:</th><td>${stats['abandons']}</td></tr>
<tr><th>Bugüne kadarki toplam tahmin sayısı:</th><td>${stats['totalGuesses']}</td></tr>
<tr><th>Bugüne kadarki ortalama tahmin sayısı:</th><td>${(stats['totalGuesses'] / totalGames).toFixed(2)}</td></tr>
</table>
`;

        $('#response').innerHTML = response;

        if (countStats) {
            saveGame(guesses.length, won ? 1 : 0);
        }
    }

    return {
        init: init,
        checkMedia: checkMedia,
    };
})();

// do this when the file loads instead of waiting for DOM to be ready to avoid
// a flash of unstyled content
Semantle.checkMedia();

window.addEventListener('load', async () => {
    Semantle.init()
});
