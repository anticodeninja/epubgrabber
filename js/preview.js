"use strict";

let id;
let previewBlock;

document.addEventListener('DOMContentLoaded', function() {
    id = document.location.hash.substr(1);
    previewBlock = document.getElementById("preview_block");

    let key = "data_" + id;
    chrome.storage.local.get(key, function (data) {
        let savedItem = data[key];
        previewBlock.innerHTML = savedItem;
    });
});

