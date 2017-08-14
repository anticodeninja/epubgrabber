"use strict";

let savedItems,
    ctrSavedPages, ctrSelectAll, ctrSelectNone, ctrDeleteSelected, ctrExportEpub;

function padLeft(value, length, char) {
    value = "" + value;
    while (value.length < length) {
        value = char + value;
    }
    return value;
}

function getPublishDate() {
    let date = new Date();
    let result = "";
    result += date.getFullYear() + "-";
    result += padLeft(date.getMonth() + 1, 2, "0") + "-";
    result += padLeft(date.getDate(), 2, "0") + " ";
    return result;
}

function getBookId() {
    let date = new Date();
    let result = "EpubGrabber ";
    result += date.getFullYear() + "-";
    result += padLeft(date.getMonth() + 1, 2, "0") + "-";
    result += padLeft(date.getDate(), 2, "0") + " ";
    result += padLeft(date.getHours(), 2, "0") + ":";
    result += padLeft(date.getMinutes(), 2, "0");
    return result;
}

function getPageInfo(id) {
    for (let i = 0; i < savedItems.list.length; ++i) {
        if (savedItems.list[i].id == id) {
            return savedItems.list[i];
        }
    }
}

function getSelected() {
    const list = document.querySelectorAll("input.select-item"),
          result = [];

    for (let i = 0; i < list.length; ++i) {
        if (list[i].checked) {
            result.push(list[i].dataset.id);
        }
    }

    return result;
}

function deleteItems(idList) {
    let result = window.confirm("Are you sure?");
    if (!result) return;

    for (let i = 0; i < idList.length; ++i) {
        chrome.storage.local.remove("savedItem" + idList[i]);
    }

    for (let i = 0; i < savedItems.list.length;) {
        if (idList.some(function(x) { return x == savedItems.list[i].id})) {
            savedItems.list.splice(i, 1);
        } else {
            i += 1;
        }
    }

    chrome.storage.local.set({savedItems: savedItems}, function(){
        renderTable();
    });
}

function initialize() {
    chrome.storage.local.get("savedItems", function (data) {
        savedItems = data.savedItems || {
            counter: 1,
            list: []
        };

        renderTable();
    });
}

function renderTable() {
    let output = '<table>';

    output += '<tr><th></th><th>Title</th><th>Location</th><th></th></tr>';

    for (let i = 0; i < savedItems.list.length; ++i) {
        let item = savedItems.list[i];
        output += '<tr>';
        output += '<td>';
        output += '<label class="chkbox">';
        output += '<input class="select-item" data-id="' + item.id + '" type="checkbox"/>';
        output += '<div class="chkbox-indicator-bg"></div>';
        output += '<div class="chkbox-indicator"></div>';
        output += '</label>';
        output += '</td>';
        output += '<td>' + item.title + '</td>';
        output += '<td><a href="' + item.location + '">' + item.location + '</a></td>';
        output += '<td>';
        output += '<a class="btn set-title" data-id="' + item.id + '" href="#">Set Title</a>';
        output += '<a class="btn preview" data-id="' + item.id + '" href="#">Preview</a>';
        output += '<a class="btn delete" data-id="' + item.id + '" href="#">Delete</a>';
        output += '</td>';
        output += '</tr>';
    }

    output += '</table>';

    ctrSavedPages.innerHTML = output;
}

function updateTitle(id) {
    let entry = getPageInfo(id);

    let result = window.prompt("New title", entry.title);
    if (result !== null) {
        entry.title = result;
        chrome.storage.local.set({savedItems: savedItems}, function(){
            renderTable();
        });
    }
}

function showPreview(id) {
    document.location = '/html/preview.html#' + id;
}

function deletePage(id) {
    deleteItems([id]);
}

function selectAll(checked) {
    let checkList = document.querySelectorAll("input.select-item");
    for (let i = 0; i < checkList.length; ++i) {
        checkList[i].checked = checked;
    }
}

function deleteSelected() {
    deleteItems(getSelected());
}

function exportEpub() {
    const exportIdList = getSelected();
    const exportKeyList = exportIdList.map(function(x) {
        return "savedItem" + x;
    });

    chrome.storage.local.get(exportKeyList, function (data) {
        let epubFile = new JSZip();
        epubFile.file("mimetype", "application/epub+zip");

        let metaFolder = epubFile.folder("META-INF");
        metaFolder.file("container.xml", getContainerContent());

        let oebpsFolder = epubFile.folder("OEBPS");

        let contentFolder = oebpsFolder.folder("content");
        let imagesFolder = oebpsFolder.folder("images");
        let cssFolder = oebpsFolder.folder("css");
        let epubHash = new jsSHA("SHA-1", "TEXT");

        let info = {
            id: undefined,
            title: getBookId(),
            date: getPublishDate(),
            chapters: [],
            images: []
        };

        for (let i = 0; i < exportIdList.length; ++i) {
            let chapterId = "chapter_" + i;
            let entryInfo = getPageInfo(exportIdList[i]);
            let entryHtml = data[exportKeyList[i]];

            let temp = document.createElement("div");
            temp.innerHTML = entryHtml;

            let imagesIds = [];
            let doc = preparePage(temp, {
                replaceImage: function(src){
                    let imageData = src.substr(src.indexOf(',') + 1);
                    let imageHash = new jsSHA("SHA-1", "TEXT");
                    imageHash.update(imageData);
                    let imageId = "img_" + i +"_" + imageHash.getHash("HEX");

                    if (!imagesIds.includes(imageId))
                    {
                        imagesIds.push(imageId);

                        info.images.push({
                            id: imageId,
                            file: imageId + ".png"
                        });

                        imagesFolder.file(imageId + ".png", imageData, {base64: true});
                    }

                    return "../images/" + imageId + ".png";
                }});

            epubHash.update(entryInfo);
            contentFolder.file(chapterId + ".xhtml", getPageContent(entryInfo, doc));
            info.chapters.push({
                id: chapterId,
                title: entryInfo.title,
                file: chapterId + ".xhtml"
            });
        }
        info.id = epubHash.getHash("HEX");

        oebpsFolder.file("content.opf", getEbookContent(info));
        oebpsFolder.file("navigation.ncx", getNavigationContent(info));
        contentFolder.file("toc.xhtml", getTocPageContent(info));
        cssFolder.file("ebook.css", getCssContent());

        epubFile.generateAsync({type: "blob"}).then(function(content){
            saveAs(content, info.title.replace(/\s/g, "_") + ".epub");
        }).catch(function(err){
            console.log(err);
        });
    });
}

document.addEventListener('DOMContentLoaded', function() {
    ctrSavedPages = document.getElementById('saved-pages');
    ctrSelectAll = document.getElementById('select-all');
    ctrSelectNone = document.getElementById('select-none');
    ctrDeleteSelected = document.getElementById('delete-selected');
    ctrExportEpub = document.getElementById('export-epub');

    ctrSavedPages.onclick = function(event) {
        let target = event.target;

        if (target.classList.contains('set-title')) {
            event.preventDefault();
            updateTitle(target.dataset.id);
        } else if (target.classList.contains('preview')) {
            event.preventDefault();
            showPreview(target.dataset.id);
        } else if (target.classList.contains('delete')) {
            event.preventDefault();
            deletePage(target.dataset.id);
        }
    }

    ctrSelectAll.onclick = function(event) {
        event.preventDefault();
        selectAll(true);
    }

    ctrSelectNone.onclick = function(event) {
        event.preventDefault();
        selectAll(false);
    }

    ctrDeleteSelected.onclick = function(event) {
        event.preventDefault();
        deleteSelected();
    }

    ctrExportEpub.onclick = function(event) {
        event.preventDefault();
        exportEpub();
    }

    initialize();
});
