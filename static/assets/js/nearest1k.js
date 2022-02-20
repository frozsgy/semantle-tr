function $(id) {
    if (id.charAt(0) !== '#') return false;
    return document.getElementById(id.substring(1));
}

function init() {
    const now = Date.now();
    const today = Math.floor(now / 86400000);
    const initialDay = 19021;
    const puzzleNumber = (today - initialDay) % secretWords.length;
    const secret = secretWords[puzzleNumber].toLowerCase();

    if (secret != $('#word').innerHTML) {
        $('#nearest').style="display:block;";
    } else {
        $('#warning').style="display:block";
        $('#warning').addEventListener('click', function(event) {
            $('#warning').style="display:none";
            $('#nearest').style="display:block";
        });
    }
}

window.addEventListener('load', init);
