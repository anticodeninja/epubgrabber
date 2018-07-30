"use strict";

let settings,
    ctrSimplifiers, ctrExport, ctrImport, ctrSave;

function initialize() {
    chromep.storage.sync.get('settings').then((data) => {
        settings = data.settings;
        renderTable();
    });
}

function renderTable() {
    let output = '<table class="simplifiers-list">';

    output += '<tr><th>URL Mask</th><th>Take</th><th>Remove</th></tr>';

    for (let i = 0, l = settings.simplifiers.length; i < l; ++i) {
        let simplifier = settings.simplifiers[i];

        output += '<tr>';
        output += '<td><input type="text" class="url" value="' + simplifier.url + '"/></td>';
        output += '<td><input type="text" class="take" value="' + simplifier.take + '"/></td>';
        output += '<td><input type="text" class="remove" value="' + simplifier.remove + '"/></td>';
        output += '</tr>';
    }

    output += '</table>';

    ctrSimplifiers.innerHTML = output;
}

function updateSettings() {
    settings.simplifiers = []

    let simplifierRows = document.querySelectorAll(".simplifiers-list tr");
    for (let i = 0, l = simplifierRows.length; i < l; ++i) {
        let ctrUrl = simplifierRows[i].querySelector(".url"),
            ctrTake = simplifierRows[i].querySelector(".take"),
            ctrRemove = simplifierRows[i].querySelector(".remove");

        if (!ctrUrl || !ctrTake || !ctrRemove || !ctrUrl.value) {
            continue;
        }

        settings.simplifiers.push({
            url: ctrUrl.value,
            take: ctrTake.value,
            remove: ctrRemove.value
        });
    }
}

document.addEventListener('DOMContentLoaded', function() {
    ctrSimplifiers = document.getElementById('simplifiers-list');
    ctrExport = document.getElementById('export');
    ctrImport = document.getElementById('import');
    ctrSave = document.getElementById('save');

    ctrExport.onclick = function(event) {
        event.preventDefault();

        updateSettings();
        let blob = new Blob([JSON.stringify(settings)], {type: "text/plain;charset=utf-8"});
        saveAs(blob, "epubgrabber.json");
    }

    ctrImport.onclick = function(event) {
        event.preventDefault();

        save(true);
    }

    ctrSave.onclick = function(event) {
        event.preventDefault();

        updateSettings();
        chromep.storage.sync.set({ settings: settings }).then(() => {
            initialize();
        });
    }

    initialize();
});
