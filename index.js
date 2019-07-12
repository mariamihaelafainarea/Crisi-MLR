const express = require('express');
const app = express();
const formidable = require('formidable')
const lineReader = require('line-reader');
var pdfjsLib = require('pdfjs-dist');
var fs = require('fs');
var Canvas = require('canvas');
var assert = require('assert');
var jsregression = require('js-regression');

var regressionFirstPages;
var regressionOtherPages;

function NodeCanvasFactory() {}
NodeCanvasFactory.prototype = {
    create: function NodeCanvasFactory_create(width, height) {
        assert(width > 0 && height > 0, 'Invalid canvas size');
        var canvas = Canvas.createCanvas(width, height);
        var context = canvas.getContext('2d');
        return {
            canvas: canvas,
            context: context,
        };
    },

    reset: function NodeCanvasFactory_reset(canvasAndContext, width, height) {
        assert(canvasAndContext.canvas, 'Canvas is not specified');
        assert(width > 0 && height > 0, 'Invalid canvas size');
        canvasAndContext.canvas.width = width;
        canvasAndContext.canvas.height = height;
    },

    destroy: function NodeCanvasFactory_destroy(canvasAndContext) {
        assert(canvasAndContext.canvas, 'Canvas is not specified');

        // Zeroing the width and height cause Firefox to release graphics
        // resources immediately, which can greatly reduce memory consumption.
        canvasAndContext.canvas.width = 0;
        canvasAndContext.canvas.height = 0;
        canvasAndContext.canvas = null;
        canvasAndContext.context = null;
    },
};

const OPS = {
    1:  'dependency',
    2:  'setLineWidth',
    3:'setLineCap',
    4:'setLineJoin',
    5:'setMiterLimit',
    6:'setDash',
    7:'setRenderingIntent',
    8:'setFlatness',
    9:'setGState',
    10:'save',
    11:'restore',
    12:'transform',
    13:'moveTo',
    14:'lineTo',
    15:'curveTo',
    16:'curveTo2',
    17:'curveTo3',
    18:'closePath',
    19:'rectangle',
    20:'stroke',
    21:'closeStroke',
    22:'fill',
    23:'eoFill',
    24:'fillStroke',
    25:'eoFillStroke',
    26:'closeFillStroke',
    27:'closeEOFillStroke',
    28:'endPath',
    29:'clip',
    30:'eoClip',
    31:'beginText',
    32:'endText',
    33:'setCharSpacing',
    34:'setWordSpacing',
    35:'setHScale',
    36:'setLeading',
    37:'setFont',
    38:'setTextRenderingMode',
    39:'setTextRise',
    40:'moveText',
    41:'setLeadingMoveText',
    42:'setTextMatrix',
    43:'nextLine',
    44:'showText',
    45:'showSpacedText',
    46:'nextLineShowText',
    47:'nextLineSetSpacingShowText',
    48:'setCharWidth',
    49:'setCharWidthAndBounds',
    50:'setStrokeColorSpace',
    51:'setFillColorSpace',
    52:'setStrokeColor',
    53:'setStrokeColorN',
    54:'setFillColor',
    55:'setFillColorN',
    56:'setStrokeGray',
    57:'setFillGray',
    58:'setStrokeRGBColor',
    59:'setFillRGBColor',
    60:'setStrokeCMYKColor',
    61:'setFillCMYKColor',
    62:'shadingFill',
    63:'beginInlineImage',
    64:'beginImageData',
    65:'endInlineImage',
    66:'paintXObject',
    67:'markPoint',
    68:'markPointProps',
    69:'beginMarkedContent',
    70:'beginMarkedContentProps',
    71:'endMarkedContent',
    72:'beginCompat',
    73:'endCompat',
    74:'paintFormXObjectBegin',
    75:'paintFormXObjectEnd',
    76:'beginGroup',
    77:'endGroup',
    78:'beginAnnotations',
    79:'endAnnotations',
    80:'beginAnnotation',
    81:'endAnnotation',
    82:'paintJpegXObject',
    83:'paintImageMaskXObject',
    84:'paintImageMaskXObjectGroup',
    85:'paintImageXObject',
    86:'paintInlineImageXObject',
    87:'paintInlineImageXObjectGroup',
    88:'paintImageXObjectRepeat',
    89:'paintImageMaskXObjectRepeat',
    90:'paintSolidColorImageMask',
    91:'constructPath',
};

app.get('/', (req, res) => {
    res.send('Hello World!');
});

async function computeElements(page, index) {
    try {
        var dict = {};
        const start = Date.now();
        await page.getOperatorList().then(function (ops) {
            console.log('page ', index, ' has ', ops.fnArray.length, ' elements');

            for (var i = 0; i < ops.fnArray.length; i++) {
                var num = ops.fnArray[i];
                dict[num] = dict[num] ? dict[num] + 1 : 1;
            }
        } );
        return dict;
    } catch (e) {
        console.log(e);
        throw e;
    }
}

async function renderElements(page, index) {
    try {
        var viewport = page.getViewport(1);
        var canvasFactory = new NodeCanvasFactory();
        var canvasAndContext =
            canvasFactory.create(viewport.width, viewport.height);
        var renderContext = {
            canvasContext: canvasAndContext.context,
            viewport: viewport,
            canvasFactory: canvasFactory,
        };

        const start = Date.now();
        await page.render(renderContext).then(function () {} );
        console.log('render page ', index, ' time = ', `${Date.now() - start}ms`);
        return Date.now() - start;
    } catch (e) {
        console.log(e);
        throw e;
    }
}

app.post('/upload', function(req, res) {

    new formidable.IncomingForm().parse(req)
        .on('field', (name, field) => {
            console.log('Field', name, field)
        })
        .on('file', (name, file) => {
            console.log('Uploaded file', name, file)

            // ------------------------------------------------------------

            if (file) {
                //Step 4:turn array buffer into typed array
                var rawData = new Uint8Array(fs.readFileSync(file.path));

                //Step 5:PDFJS should be able to read this
                pdfjsLib.getDocument(rawData).then(async function (pdf) {
                    console.log("the pdf has ", pdf.numPages, "page(s).")

                    for (var i = 1; i <= pdf.numPages; i++) {

                        await pdf.getPage(i).then((async function (index, page) {
                            //compute elements
                            var dict = await computeElements(page, index);

                            //compute render
                            var time = await renderElements(page, index);

                            var line = '';

                            for (var key in OPS) {
                                line += (dict[key] ? dict[key] : 0) + ', ';
                            }

                            line += time + '\n';

                            if(i == 1 || i == 2) {
                                fs.appendFileSync('FirstPage.csv', line, (err) => {
                                    if (err) throw err;
                                });
                            }
                            else {
                                fs.appendFileSync('Others.csv', line, (err) => {
                                    if (err) throw err;
                                });
                            }
                        }).bind(null, i));

                    }

                });
            }

            // ------------------------------------------------------------
        })
        .on('aborted', () => {
            console.error('Request aborted by the user')
        })
        .on('error', (err) => {
            console.error('Error', err)
            throw err
        })
        .on('end', () => {
            res.end()
        })

    res.send('Thank you!');
});

app.post('/predict', function(req, res) {

    console.log('predict');

    new formidable.IncomingForm().parse(req)
        .on('field', (name, field) => {
            console.log('Field', name, field)
        })
        .on('file', (name, file) => {
            console.log('Uploaded file', name, file)

            // ------------------------------------------------------------

            if (file) {
                //Step 4:turn array buffer into typed array
                var rawData = new Uint8Array(fs.readFileSync(file.path));
                console.log('mama');
                //Step 5:PDFJS should be able to read this
                pdfjsLib.getDocument(rawData).then(async function (pdf) {
                    console.log("the pdf has ", pdf.numPages, "page(s).")

                    for (var i = 1; i <= pdf.numPages; i++) {

                        await pdf.getPage(i).then((async function (index, page) {
                            //compute elements
                            var dict = await computeElements(page, index);

                            var predicted_y;

                            //do the prediction
                            var xs = [];
                            for (var key in OPS) {
                                xs.push(dict[key] ? dict[key] : 0);
                            }
                            if(i == 1 || i == 2) {
                                try {
                                    var spawn = require("child_process").spawn;
                                    var process = spawn('python', ["./Mlr.py", "FirstPages.csv"]);
                                    process.stdout.on('data', function (data) {
                                        predicted_y.send(data.toString());
                                    });
                                    process.stderr.on('data', function (data) {
                                        console.log(String.fromCharCode.apply(null, data));
                                    });
                                }catch(e) {
                                    console.log(e.stack);
                                }

                            }
                            else {
                                try {
                                    var spawn = require("child_process").spawn;
                                    var process = spawn('python', ["./Mlr.py", "OtherPages.csv"])
                                    process.stdout.on('data', function (data) {
                                        predicted_y.send(data.toString())
                                    })
                                }catch(e){
                                    console.log(e.stack);
                                }
                            }

                            //compute render
                            var time = await renderElements(page, index);

                            console.log('predicted1 = ', predicted_y, ' actual = ', time);

                        }).bind(null, i));

                    }

                });
            }

            // ------------------------------------------------------------
        })
        .on('aborted', () => {
            console.error('Request aborted by the user')
        })
        .on('error', (err) => {
            console.error('Error', err)
            throw err
        })
        .on('end', () => {
            res.end()
        })

    res.send('done!');
});

app.post('/file',function(req, res) {
    new formidable.IncomingForm().parse(req)
        .on('field', (name, field) => {
            console.log('Field', name, field)
        })
        .on('file', (name, file) => {
            console.log('file', name, file)

            if (file) {
                //Step 4:turn array buffer into typed array
                var rawData = new Uint8Array(fs.readFileSync(file.path));
                //Step 5:PDFJS should be able to read this
                pdfjsLib.getDocument(rawData).then(async function (pdf) {
                    console.log("the pdf has ", pdf.numPages, "page(s).")
                    var estimated_render_time = 0;

                    for (var i = 1; i <= pdf.numPages; i++) {

                        await pdf.getPage(i).then((async function (index, page) {
                            //compute elements
                            var dict = await computeElements(page, index);

                            var predicted_y;

                            //do the prediction
                            var xs = [];
                            for (var key in OPS) {
                                xs.push(dict[key] ? dict[key] : 0);
                            }
                            if(i == 1 || i == 2) {
                                predicted_y = regressionFirstPages.transform(xs);
                            }
                            else {
                                predicted_y = regressionOtherPages.transform(xs);
                            }

                            //compute render
                            estimated_render_time += predicted_y;

                        }).bind(null, i));
                    }

                    line = file.name + "," + file.size + "," + pdf.numPages + "," + estimated_render_time;

                    s.appendFileSync('Results.csv', line, (err) => {
                        if (err) throw err;
                    });

                });
            }
        });
});

app.listen(8000, () => {
    console.log('Example app listening on port 8000!')
});