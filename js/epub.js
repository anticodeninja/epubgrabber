'use strict';

const EPUB_UNSUPPORTED_BLOCKS = ['header', 'blockquote', 'dl', 'dt', 'dd'];
const EPUB_UNSUPPORTED_SPANS = ['button', 'time', 's'];

const RST_HEADERS = {
    'h1': { b: '=', a: '='},
    'h2': { b: '-', a: '-'},
    'h3': { b: '`', a: '`'},
    'h4': { b: '', a: '='},
    'h5': { b: '', a: '-'},
    'h6': { b: '', a: '`'}
}

function escapeHtmlEntities(value, full) {
    value = value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    if (full) value = value.replace(/"/g, '&quot;');
    return value;
}

function contentObligatory(nodeName) {
    return CONTENT_OBLIGATORY.includes(nodeName);
}

function extractText(element, context) {
    let pre = context && context.pre;
    let textContent = escapeHtmlEntities(element.nodeValue, !pre);
    if (!pre) {
        if (textContent.trim().length != 0) {
            textContent = textContent.replace(/^[\r\n]+|[\r\n]+$/g, '');
        } else {
            textContent = '';
        }
    }
    return textContent;
}

function saveImage(images, image) {
    let imageData = image.substr(image.indexOf(',') + 1);
    let imageHash = new jsSHA('SHA-1', 'TEXT');
    imageHash.update(imageData);
    let format = image.match(/^data:(image\/([^;]+))/);
    let imageId = 'img_' + imageHash.getHash('HEX') + '.' + format[2];

    if (!images[imageId]) {
        images[imageId] = { data: imageData, type: format[1] };
    }

    return imageId;
}

function getAttr(element, name, defValue, callback) {
    let attr = element.attributes[name];
    if (attr) {
        callback(attr.nodeValue);
    } else if (defValue !== undefined) {
        callback(defValue);
    }
}

function prepareEpub(source) {
    const result = [];
    const images = {};
    const levels = [];

    function normalize() {
        function isBlockStart(value) {
            let match = value.match(/^<\/?([^\/> ]+)/);
            return match && BLOCKS.includes(match[1]);
        }
        let temp = '', offset = result.length - 1;
        while (offset > 0 && !isBlockStart(result[offset])) temp = result[offset--] + temp;
        temp = temp != '' ? temp.replace(/^(\n|\s)*|(\n|\s)*$/g, '').split('\n') : [];
        result.splice(offset + 1, result.length - (offset + 1), ...temp);
    }

    function recurse(current) {
        let prevLevel = levels.length > 0 ? levels[levels.length - 1] : {};
        for (let i = 0, children = current.childNodes; i < children.length; i++) {
            let obj = children[i];
            if (obj.nodeType == Node.TEXT_NODE) {
                let text = extractText(obj, levels[levels.length-1]);
                if (text.length > 0) result.push(text);
            } else if (obj.nodeType == Node.ELEMENT_NODE) {
                let nodeName = obj.nodeName.toLowerCase();
                if (skipTag(nodeName)) {
                    continue;
                }

                if (EPUB_UNSUPPORTED_BLOCKS.includes(nodeName)) nodeName = 'div';
                if (EPUB_UNSUPPORTED_SPANS.includes(nodeName)) nodeName = 'span';

                if (BLOCKS.includes(nodeName) && !prevLevel.block) {
                    for (let j = 0; j < levels.length; ++j) {
                        if (!BLOCKS.includes(levels[j].tag)) {
                            levels[j].tag = 'div';
                        }
                    }
                }

                let blockNode = BLOCKS.includes(nodeName);

                if (blockNode) {
                    normalize();
                }

                levels.push({
                    offset: result.length,
                    tag: nodeName,
                    pre: prevLevel.pre || nodeName == 'pre',
                    block: prevLevel.block && blockNode
                });

                recurse(obj);

                let last = levels.pop();
                if (last.tag == 'a') {
                    getAttr(obj, 'href', undefined, x => {
                        result[result.length - 1] += ' [' + escapeHtmlEntities(x, true) + ']';
                    });
                } else if (last.tag == 'img') {
                    let img = 'img';
                    getAttr(obj, 'alt', '', x => img += ' alt="' + x + '"');
                    getAttr(obj, 'src', blankGif, x => img += ' src="../images/' + saveImage(images, x) + '"');
                    if (obj.width >= 300) img += ' class="full"';
                    result.push('<' + img + '/>');
                } else if (last.tag == 'br') {
                    if (result[result.length - 1] != '<br/>') result.push('<br/>');
                } else if (result.length != last.offset && result[result.length - 1] != '</' + last.tag + '>') {
                    let [ start, stop ] = last.tag != 'span' // ignore
                        ? ['<' + last.tag + '>', '</' + last.tag + '>']
                        : [ '', '' ];

                    if (BLOCKS.includes(last.tag)) {
                        result.splice(last.offset, 0, start);
                        normalize();
                        result.push(stop);
                    } else {
                        result[last.offset] = start + result[last.offset];
                        result[result.length - 1] = result[result.length - 1] + stop;
                    }
                }
            }
        }
    }

    recurse(source);
    return [result, images];
}

function prepareRst(source) {
    const NORMALIZE_ONELINE = 1;
    const NORMALIZE_MULTILINE = 2;
    const NORMALIZE_PRESERVE = 3;
    const SPLIT_MARKS = ['.', '?', '!'];

    const result = [];
    const images = {};
    const levels = [];

    let normalizedOffset = 0;

    function normalize(offset, mode) {
        let temp = [], combined = '';
        for (let i = result.length - 1; i >= offset && i >= normalizedOffset; --i) {
            let chunk = result[i];
            if (mode != NORMALIZE_PRESERVE) {
                chunk = chunk.trim().replace(/\s+/, ' ');
                if (combined.length > 0) {
                    chunk = chunk + ' ';
                }
            }
            combined = chunk + combined;
        }
        normalizedOffset = Math.max(normalizedOffset, offset);

        if (combined.length == 0) {
            return;
        }

        if (mode == NORMALIZE_PRESERVE) {
            temp = combined.split('\n');
            while (temp.length > 0 && temp[0].length == 0) temp.splice(0, 1);
            while (temp.length > 0 && temp[temp.length - 1].length == 0) temp.splice(temp.length - 1, 1);
        } else if (mode == NORMALIZE_MULTILINE) {
            let startChunk = 0;
            for (let i = 0, len = combined.length - 1; i < len; ++i) {
                if (SPLIT_MARKS.includes(combined[i]) && combined[i + 1] == ' ') {
                    temp.push(combined.substring(startChunk, i + 1).trim());
                    startChunk = i + 1;
                }
            }
            temp.push(combined.substring(startChunk).trim());
        } else if (mode == NORMALIZE_ONELINE) {
            temp = [combined];
        }

        result.splice(normalizedOffset, result.length - normalizedOffset, ...temp);
    }

    function insert(offset, pad, value) {
        let existPad = 0;
        while (existPad < pad && (offset - existPad - 1 < 0 || result[offset - existPad - 1].length == 0)) {
            existPad += 1;
        }

        let temp = [];
        for (let i = existPad; i < pad; ++i) {
            temp.push('');
        }
        if (value) {
            temp.push(value);
        }

        result.splice(offset, 0, ...temp);
    }

    function recurse(current) {
        let prevLevel = levels.length > 0 ? levels[levels.length - 1] : {};
        for (let i = 0, children = current.childNodes; i < children.length; i++) {
            let obj = children[i];
            if (obj.nodeType == Node.TEXT_NODE) {
                let text = extractText(obj, levels[levels.length-1]);
                if (text.length > 0) result.push(text);
            } else if (obj.nodeType == Node.ELEMENT_NODE) {
                let nodeName = obj.nodeName.toLowerCase();
                if (skipTag(nodeName)) {
                    continue;
                }

                levels.push({
                    offset: result.length,
                    tag: nodeName,
                    pre: prevLevel.pre || nodeName == 'pre'
                });
                recurse(obj);

                let last = levels.pop();
                if (RST_HEADERS[last.tag]) {
                    normalize(last.offset, NORMALIZE_ONELINE);
                    let header = result[result.length-1],
                        headerParam = RST_HEADERS[last.tag],
                        start = '',
                        stop = '';

                    for (let i = 0, len = header.length; i < len; ++i) {
                        start += headerParam.b;
                        stop += headerParam.a;
                    }

                    insert(last.offset, 2, start);
                    result.push(stop);
                    normalizedOffset = result.length;
                } else if (last.tag == 'a') {
                    normalize(last.offset, NORMALIZE_ONELINE);
                    getAttr(obj, 'href', undefined, x => {
                        let last = result.length - 1;
                        result[last] = '`' + result[last] + ' <' + escapeHtmlEntities(x, true) + '>`';
                    });
                } else if (last.tag == 'i') {
                    result[last.offset] = '*' + result[last.offset];
                    result[result.length - 1] = result[result.length - 1] + '*';
                } else if (last.tag == 'b') {
                    result[last.offset] = '**' + result[last.offset];
                    result[result.length - 1] = result[result.length - 1] + '**';
                } else if (last.tag == 'li') {
                    // if (prevLevel.ol) {
                    //     result += '#. ';
                    // } else if (prevLevel.ul) {
                    //     result += '* ';
                    // }
                    // result += content + '\n';
                } else if (last.tag == 'pre') {
                    normalize(last.offset, NORMALIZE_PRESERVE);
                    for (let i = last.offset; i < result.length; ++i) {
                        result[i] = '   ' + result[i];
                    }
                    insert(last.offset, 1, null);
                    insert(last.offset, 1, '.. code::');
                    normalizedOffset = result.length;
                } else if (last.tag == 'div' || last.tag == 'p') {
                    normalize(last.offset, NORMALIZE_MULTILINE);
                    insert(last.offset, 1, null);
                    normalizedOffset = result.length;
                } else if (last.tag == 'img') {
                    normalize(last.offset, NORMALIZE_MULTILINE);
                    getAttr(obj, 'src', blankGif, function(x) {
                        result.push('.. image:: ' + saveImage(images, x));
                        getAttr(obj, 'alt', undefined, x => result.push('   :alt: ' + x));
                        result.push('');
                    });
                    normalizedOffset = result.length;
                }
            }
        }
    }

    recurse(source);
    return [result, images];
}


function getContainerContent() {
    let result = "";
    result += "<?xml version=\"1.0\" encoding=\"UTF-8\" ?>\n";
    result += "<container version=\"1.0\" xmlns=\"urn:oasis:names:tc:opendocument:xmlns:container\">\n";
    result += "  <rootfiles>\n";
    result += "    <rootfile full-path=\"OEBPS/content.opf\" media-type=\"application/oebps-package+xml\"/>\n";
    result += "  </rootfiles>\n";
    result += "</container>\n";
    return result;
}

function getEbookContent(info) {
    let result = "";
    result += "<?xml version=\"1.0\" encoding=\"utf-8\"?>\n";
    result += "<package xmlns=\"http://www.idpf.org/2007/opf\" version=\"2.0\" unique-identifier=\"BookId\">\n";
    result += "<metadata xmlns:dc=\"http://purl.org/dc/elements/1.1/\"\n";
    result += "          xmlns:opf=\"http://www.idpf.org/2007/opf\">\n";
    result += "  <dc:title>" + info.title + "</dc:title>\n";
    result += "  <dc:description></dc:description>\n";
    result += "  <dc:date>" + info.date + "</dc:date>\n";
    result += "  <dc:identifier id=\"BookId\" opf:scheme=\"uid\">" + info.id + "</dc:identifier>\n";
    result += "  <dc:language>en</dc:language>\n";
    result += "  <dc:rights>Unknown</dc:rights>\n";
    result += "</metadata>\n";
    result += "<manifest>\n";
    result += "  <item id=\"navigation\" media-type=\"application/x-dtbncx+xml\" href=\"navigation.ncx\"/>\n";
    result += "  <item id=\"toc\" media-type=\"application/xhtml+xml\" href=\"content/toc.xhtml\"/>\n";
    result += "  <item id=\"css\" media-type=\"text/css\" href=\"css/ebook.css\"/>\n";
    for (let i = 0; i < info.chapters.length; ++i) {
        result += "  <item id=\"" + info.chapters[i].id + "\" media-type=\"application/xhtml+xml\"" +
            " href=\"content/" + info.chapters[i].file + "\"/>\n";
    }
    for (let i = 0; i < info.images.length; ++i) {
        result += "  <item id=\"" + info.images[i].name + "\" media-type=\"" + info.images[i].type + "\"" +
            " href=\"images/" + info.images[i].name + "\"/>\n";
    }
    result += "</manifest>\n";
    result += "<spine toc=\"navigation\">\n";
    result += "  <itemref idref=\"toc\"/>\n";
    for (let i = 0; i < info.chapters.length; ++i) {
        result += "  <itemref idref=\"" + info.chapters[i].id + "\"/>\n";
    }
    result += "</spine>\n";
    result += "<guide>\n";
    result += "  <reference type=\"toc\" title=\"Contents\" href=\"content/toc.xhtml\"></reference>\n";
    result += "</guide>\n";
    result += "</package>\n";
    return result;
}

function getNavigationContent(info) {
    let result = "";
    result += "<?xml version=\"1.0\"?>\n";
    result += "<!DOCTYPE ncx PUBLIC \"-//NISO//DTD ncx 2005-1//EN\"\n";
    result += "  \"http://www.daisy.org/z3986/2005/ncx-2005-1.dtd\">\n";
    result += "\n";
    result += "<ncx xmlns=\"http://www.daisy.org/z3986/2005/ncx/\" version=\"2005-1\">\n";
    result += "  <head>\n";
    result += "    <meta name=\"dtb:uid\" content=\"" + info.id + "\"/>\n";
    result += "    <meta name=\"dtb:depth\" content=\"1\"/>\n";
    result += "    <meta name=\"dtb:totalPageCount\" content=\"0\"/>\n";
    result += "    <meta name=\"dtb:maxPageNumber\" content=\"0\"/>\n";
    result += "  </head>\n";
    result += "  <docTitle>\n";
    result += "    <text>" + escapeHtmlEntities(info.title, true) + "</text>\n";
    result += "  </docTitle>\n";
    result += "  <navMap>\n";
    result += "    <navPoint id=\"toc\" playOrder=\"1\">\n";
    result += "      <navLabel>\n";
    result += "        <text></text>\n";
    result += "      </navLabel>\n";
    result += "      <content src=\"content/toc.xhtml\"/>\n";
    result += "    </navPoint>\n";
    for (let i = 0; i < info.chapters.length; ++i) {
        result += "    <navPoint id=\"" + info.chapters[i].id + "\" playOrder=\"" + (2 + i) + "\">\n";
        result += "      <navLabel>\n";
        result += "        <text>" + escapeHtmlEntities(info.chapters[i].title, true) + "</text>\n";
        result += "      </navLabel>\n";
        result += "      <content src=\"content/" + info.chapters[i].file + "\"/>\n";
        result += "    </navPoint>\n";
    }
    result += "  </navMap>\n";
    result += "</ncx>\n";
    return result;
}

function getTocPageContent(info) {
    let result = "";
    result += "<?xml version=\"1.0\" encoding=\"utf-8\"?>\n";
    result += "<!DOCTYPE html PUBLIC \"-//W3C//DTD XHTML 1.1//EN\"";
    result += "                      \"http://www.w3.org/TR/xhtml11/DTD/xhtml11.dtd\">\n";
    result += "<html xmlns=\"http://www.w3.org/1999/xhtml\">\n";
    result += "  <head>\n";
    result += "    <title>Table of Contents</title>\n";
    result += "    <link rel=\"stylesheet\" type=\"text/css\" href=\"../css/ebook.css\"/>";
    result += "  </head>\n";
    result += "  <body>\n";
    result += "    <h2>Table of Contents</h2>\n";
    result += "    <ol class=\"toc-items\">\n";
    for (let i = 0; i < info.chapters.length; ++i) {
        result += "      <li><a href=\"" + info.chapters[i].file + "\">" +
            escapeHtmlEntities(info.chapters[i].title, true) + "</a></li>\n";
    }
    result += "    </ol>\n";
    result += "  </body>\n";
    result += "</html>\n";
    return result;
}

function getPageContent(info, payload) {
    let result = [];

    result.push('<?xml version="1.0" encoding="utf-8"?>');
    result.push('<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.1//EN"');
    result.push('                      "http://www.w3.org/TR/xhtml11/DTD/xhtml11.dtd">');
    result.push('<html xmlns="http://www.w3.org/1999/xhtml">');
    result.push('  <head profile="http://dublincore.org/documents/dcmi-terms/">');
    result.push('    <meta http-equiv="Content-Type" content="text/html;" />');
    result.push('    <title>' + escapeHtmlEntities(info.title, true) + '</title>');
    result.push('    <link rel="stylesheet" type="text/css" href="../css/ebook.css"/>');
    result.push('    <meta name="DCTERMS.title" content="' + escapeHtmlEntities(info.title, true) + '" />');
    result.push('    <meta name="DCTERMS.language" content="en" scheme="DCTERMS.RFC4646" />');
    result.push('    <link rel="schema.DC" href="http://purl.org/dc/elements/1.1/" hreflang="en" />');
    result.push('    <link rel="schema.DCTERMS" href="http://purl.org/dc/terms/" hreflang="en" />');
    result.push('    <link rel="schema.DCTYPE" href="http://purl.org/dc/dcmitype/" hreflang="en" />');
    result.push('    <link rel="schema.DCAM" href="http://purl.org/dc/dcam/" hreflang="en" />');
    result.push('  </head>');
    result.push('  <body>');
    result = result.concat(payload);
    result.push('  </body>');
    result.push('</html>');

    return result.join('\n');
}

function getCssContent() {
    let result = [];

    result.push('body {');
    result.push('  font-size: medium;');
    result.push('}');

    result.push('img.full {');
    result.push('  max-width: 100%');
    result.push('}');

    result.push('code, pre {');
    result.push('  white-space: pre-wrap;');
    result.push('  font-size: 75%;');
    result.push('}');

    return result.join('\n');
}
