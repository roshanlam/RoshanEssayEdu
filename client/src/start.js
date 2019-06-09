/*
* Go to the ts file to see this in typescript
*/
define(["require", "exports", "d3", "./etc/SimpleEventHandler", "./api/GLTR_API", "./vis/GLTR_Text_Box", "./vis/ToolTip", "./etc/URLHandler", "./vis/Histogram", "./vis/BarChart", "d3-selection-multi", "../css/start.scss", "!file-loader?name=index.html!../index.html"], function (require, exports, d3, SimpleEventHandler_1, GLTR_API_1, GLTR_Text_Box_1, ToolTip_1, URLHandler_1, Histogram_1, BarChart_1) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var current = {
        sidebar: {
            width: 400,
            visible: false
        },
        demo: true,
        entropyThreshold: 10,
        project_name: 'gpt-2-small'
    };
    var mapIDtoEnum = {
        mode_topk: GLTR_Text_Box_1.GLTR_Mode.topk,
        mode_diff_p: GLTR_Text_Box_1.GLTR_Mode.diff_p,
        mode_frac_p: GLTR_Text_Box_1.GLTR_Mode.fract_p
    };
    window.onload = function () {
        var eventHandler = new SimpleEventHandler_1.SimpleEventHandler(d3.select('body').node());
        if (URLHandler_1.default.parameters['nodemo']) {
            current.demo = false;
        }
        var side_bar = d3.select(".side_bar");
        side_bar.style('width', current.sidebar.width + "px");
        var api_prefix = URLHandler_1.default.parameters['api'] || '';
        var api = new GLTR_API_1.GLTR_API(api_prefix);
        var toolTip = new ToolTip_1.ToolTip(d3.select('#major_tooltip'), eventHandler);
        var submitBtn = d3.select('#submit_text_btn');
        var textField = d3.select('#test_text');
        var all_mode_btn = d3.selectAll('.btn_mode');
        var stats_top_k = new BarChart_1.BarChart(d3.select('#stats_top_k'), eventHandler);
        var stats_frac = new Histogram_1.Histogram(d3.select('#stats_frac'), eventHandler);
        var stats_entropy = new Histogram_1.Histogram(d3.select('#stats_entropy'), eventHandler);
        var currentColorThresholds = function () {
            return [
                +d3.select('#color1').property('value'),
                +d3.select('#color2').property('value'),
                +d3.select('#color3').property('value'),
            ];
        };
        var currentMode = function () {
            var id = all_mode_btn
                .filter(function () {
                return d3.select(this).classed('selected');
            })
                .property('id');
            return mapIDtoEnum[id];
        };
        var lmf = new GLTR_Text_Box_1.GLTR_Text_Box(d3.select("#results"), eventHandler, { color_thresholds: currentColorThresholds() });
        // *****************************
        // *****  demo stuff *****
        // *****************************
        var startSystem = function () {
            d3.select('#model_name').text(current.project_name);
            d3.select('#loader').style('opacity', 0);
            d3.selectAll('.main_frame').style('opacity', 1);
        };
        if (current.demo) {
            // d3.json('demo/examples.json').then(
            var all_demos = require('../demo/' + current.project_name + '_examples.json');
            var load_demo_1 = function (d) {
                updateFromRequest(d.api);
                textField.property('value', d.api.request.text);
            };
            d3.select('.demos').selectAll('.demoBtn').data(all_demos)
                .join('div')
                .attr('class', 'demoBtn')
                .html(function (d) { return d.description; })
                .on('click', function (d) {
                submitBtn.classed('inactive', true);
                if (!d.api) {
                    d3.selectAll(".loadersmall").style('display', null);
                    d3.json('demo/' + d.file).then(function (api_r) {
                        d.api = api_r;
                        load_demo_1(d);
                    });
                }
                else {
                    load_demo_1(d);
                }
            });
            startSystem();
        }
        else {
            api.all_projects().then(function (projects) {
                current.project_name = Object.keys(projects)[0];
                d3.selectAll('.demo').remove();
                startSystem();
            });
        }
        // *****************************
        // *****  Update Vis *****
        // *****************************
        var updateTopKstat = function () {
            var u = lmf.colorStats;
            stats_top_k.update(u);
        };
        var updateEntropyStat = function (data) {
            var entropies = data.result.pred_topk.map(function (topK) {
                var allV = topK.slice(0, current.entropyThreshold).map(function (k) { return k[1]; });
                var sum = allV.reduce(function (sum, actual) { return sum + actual; });
                var entropy = -1. * allV
                    .map(function (v) { return v / sum; })
                    .map(function (x) { return x == 0 ? 0 : x * Math.log(x); })
                    .reduce(function (s, a) { return s + a; }, 0);
                return entropy;
            });
            stats_entropy.update({
                data: entropies,
                no_bins: 8
            });
        };
        var updateFromRequest = function (data) {
            console.log(data, "--- data");
            d3.select('#all_result').style('opacity', 1).style('display', null);
            d3.selectAll(".loadersmall").style('display', 'none');
            lmf.update(data.result);
            updateTopKstat();
            updateEntropyStat(data);
            // stats_top_k.update({
            //     color: "#70b0ff",
            //     detail: data.result.real_topk.map(d => d[0]),//.filter(d => d < 11),
            //     label: "top k labels",
            //     noBins: 10
            // })
            var fracs = data.result.real_topk.map(function (d, i) { return d[1] / (data.result.pred_topk[i][0][1]); });
            stats_frac.update({
                data: fracs,
                label: "frac",
                no_bins: 10,
                extent: [0, 1]
            });
            submitBtn.classed('inactive', false);
        };
        submitBtn.on('click', function () {
            var t = textField.property('value');
            d3.selectAll(".loadersmall").style('display', null);
            submitBtn.classed('inactive', true);
            api.analyze(current.project_name, t).then(updateFromRequest);
        });
        // *****************************
        // *****  mode change  *****
        // *****************************
        all_mode_btn
            .on('click', function () {
            var me = this;
            all_mode_btn.classed('selected', function () {
                return this === me;
            });
            lmf.updateOptions({ gltrMode: currentMode() }, true);
        });
        d3.selectAll('.colorThreshold').on('input', function () {
            lmf.updateThresholdValues(currentColorThresholds());
            updateTopKstat();
        });
        eventHandler.bind(GLTR_Text_Box_1.GLTR_Text_Box.events.tokenHovered, function (ev) {
            if (ev.hovered) {
                toolTip.updateData(ev.d);
            }
            else {
                toolTip.visility = false;
            }
        });
        d3.select('body').on('touchstart', function () {
            toolTip.visility = false;
        });
        var mainWindow = {
            width: function () { return window.innerWidth - (current.sidebar.visible ? current.sidebar.width : 0); },
            height: function () { return window.innerHeight - 195; }
        };
        function setup_ui() {
            d3.select('#sidebar_btn')
                .on('click', function () {
                var sb = current.sidebar;
                sb.visible = !sb.visible;
                d3.select(this)
                    .classed('on', sb.visible);
                side_bar.classed('hidden', !sb.visible);
                side_bar.style('right', sb.visible ? null : "-" + current.sidebar.width + "px");
                re_layout();
            });
            window.onresize = function () {
                var w = window.innerWidth;
                var h = window.innerHeight;
                // console.log(w, h, "--- w,h");
                re_layout(w, h);
            };
            function re_layout(w, h) {
                if (w === void 0) { w = window.innerWidth; }
                if (h === void 0) { h = window.innerHeight; }
                d3.selectAll('.sidenav')
                    .style('height', (h - 53) + 'px');
                var sb = current.sidebar;
                var mainWidth = w - (sb.visible ? sb.width : 0);
                d3.selectAll('.main_frame')
                    .style('height', (h - 53) + 'px')
                    .style('width', mainWidth + 'px');
                // eventHandler.trigger(GlobalEvents.window_resize, {w, h})
                // eventHandler.trigger(GlobalEvents.main_resize, {
                //     w: (w - global.sidebar()),
                //     h: (h - 45)
                // })
            }
            re_layout(window.innerWidth, window.innerHeight);
        }
        setup_ui();
    };
});
