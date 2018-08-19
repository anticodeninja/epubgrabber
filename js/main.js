"use strict";

let loadedMetadata,
    ctrSavedPages, ctrSelectAll, ctrSelectNone, ctrDeleteSelected, ctrExportEpub, ctrExportRst;

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
    result += date.getFullYear();
    result += padLeft(date.getMonth() + 1, 2, "0");
    result += padLeft(date.getDate(), 2, "0") + "T";
    result += padLeft(date.getHours(), 2, "0");
    result += padLeft(date.getMinutes(), 2, "0");
    return result;
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
    const deletedTitles = [];
    for (let i = 0, l = idList.length; i < l; ++i) {
        deletedTitles.push(loadedMetadata["info_" + idList[i]].title);
    }

    let result = window.confirm("Are you sure that you want to delete the following articles?\n" + deletedTitles.join("\n"));
    if (!result) return;

    for (let i = 0; i < idList.length; ++i) {
        chrome.storage.sync.remove("info_" + idList[i]);
        chrome.storage.local.remove("data_" + idList[i]);
    }

    for (let i = 0; i < loadedMetadata.indexer.list.length;) {
        if (idList.some(function(x) { return x == loadedMetadata.indexer.list[i]})) {
            loadedMetadata.indexer.list.splice(i, 1);
        } else {
            i += 1;
        }
    }

    chrome.storage.sync.set({"indexer": loadedMetadata.indexer}, function(){
        renderTable();
    });
}

function initialize() {
    chrome.storage.sync.get(null, function (data) {
        loadedMetadata = data;
        renderTable();
    });
}

function renderTable() {
    let output = '<table class="page-list">';

    output += '<tr><th></th><th>Title</th><th>Location</th><th></th></tr>';

    for (let i = 0; i < loadedMetadata.indexer.list.length; ++i) {
        let id = loadedMetadata.indexer.list[i],
            info = loadedMetadata['info_' + id];

        output += '<tr>';
        output += '<td>';
        output += '<label class="chkbox">';
        output += '<input class="select-item" data-id="' + id + '" type="checkbox"/>';
        output += '<div class="chkbox-indicator-bg"></div>';
        output += '<div class="chkbox-indicator"></div>';
        output += '</label>';
        output += '</td>';
        output += '<td>' + info.title + '</td>';
        output += '<td><a href="' + info.location + '" target="_blank">' + info.location + '</a></td>';
        output += '<td>';
        output += '<a class="btn set-title" data-id="' + id + '" href="#">Set Title</a>';
        output += '<a class="btn preview" data-id="' + id + '" href="#">Preview</a>';
        output += '<a class="btn delete" data-id="' + id + '" href="#">Delete</a>';
        output += '</td>';
        output += '</tr>';
    }

    output += '</table>';

    ctrSavedPages.innerHTML = output;
}

function updateTitle(id) {
    let entry = loadedMetadata['info_' + id],
        result = window.prompt("New title", entry.title);

    if (result !== null) {
        entry.title = result;
        let metadata = {};
        metadata["info_" + id] = entry;
        chrome.storage.sync.set(metadata, function(){
            renderTable();
        });
    }
}

function showPreview(id) {
    window.open('/html/preview.html#' + id, '_blank');
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

function loadPages(callback) {
    const exportIdList = getSelected();
    const exportKeyList = exportIdList.map(function(x) {
        return "data_" + x;
    });

    chrome.storage.local.get(exportKeyList, function (data) {
        const notExistInLocalStorage = [];
        for (let i = 0, l = exportIdList.length; i < l; ++i) {
            if (!data["data_" + exportIdList[i]]) {
                notExistInLocalStorage.push(
                    loadedMetadata["info_" + exportIdList[i]].title);
            }
        }

        if (notExistInLocalStorage.length > 0) {
            window.alert("The following pages are not existed in local storage:\n" + notExistInLocalStorage.join("\n"));
            return;
        }

        callback(exportIdList, data);
    });
}

function saveFile(file, filename) {
    file.generateAsync({type: "blob"}).then(function(content){
        var url = window.URL.createObjectURL(content);
        chrome.downloads.download({
            url: url,
            filename: filename,
            saveAs: true,
            conflictAction: 'prompt'
        }, function() {
            window.URL.revokeObjectURL(url);
        });
    }).catch(function(err){
        console.log(err);
    });
}

function exportEpub() {
    loadPages(function (exportIdList, data) {
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

        let saved = 0;
        for (let i = 0, len = exportIdList.length; i < len; ++i) {
            let chapterId = "chapter_" + i;
            let entryInfo = loadedMetadata["info_" + exportIdList[i]];
            let entryHtml = data["data_" + exportIdList[i]];

            epubHash.update(entryInfo);
            info.chapters.push({
                id: chapterId,
                title: entryInfo.title,
                file: chapterId + ".xhtml"
            });

            prepareElement(entryHtml, x => {
                const [doc, images] = prepareEpub(x);
                contentFolder.file(chapterId + ".xhtml", getPageContent(entryInfo, doc));
                for (let image in images) {
                    info.images.push({ name: image, type: images[image].type });
                    imagesFolder.file(image, images[image].data, {base64: true});
                }

                saved += 1;
                if (saved == len) {
                    info.id = epubHash.getHash("HEX");

                    oebpsFolder.file("content.opf", getEbookContent(info));
                    oebpsFolder.file("navigation.ncx", getNavigationContent(info));
                    contentFolder.file("toc.xhtml", getTocPageContent(info));
                    cssFolder.file("ebook.css", getCssContent());

                    saveFile(epubFile, info.title.replace(/\s/g, "_") + ".epub");
                }
            });
        }
    });
}

function exportRst() {
    loadPages(function (exportIdList, data) {
        let zipFile = new JSZip();

        let saved = 0;
        for (let i = 0, len = exportIdList.length; i < len; ++i) {
            let entryInfo = loadedMetadata["info_" + exportIdList[i]];
            let pageId = "page_" + i;
            let pageFolder = zipFile.folder(pageId);
            let entryHtml = data["data_" + exportIdList[i]];

            prepareElement(entryHtml, x => {
                const [doc, images] = prepareRst(x);
                pageFolder.file("index.rst", doc.join('\n'));
                for (let image in images) {
                    pageFolder.file(image, images[image].data, {base64: true});
                }

                saved += 1;
                if (saved == len) {
                    saveFile(zipFile, getBookId().replace(/\s/g, "_") + ".zip");
                }
            });
        }
    });
}

document.addEventListener('DOMContentLoaded', function() {
    ctrSavedPages = document.getElementById('saved-pages');
    ctrSelectAll = document.getElementById('select-all');
    ctrSelectNone = document.getElementById('select-none');
    ctrDeleteSelected = document.getElementById('delete-selected');
    ctrExportEpub = document.getElementById('export-epub');
    ctrExportRst = document.getElementById('export-rst');

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

    ctrExportRst.onclick = function(event) {
        event.preventDefault();
        exportRst();
    }

    initialize();
});
