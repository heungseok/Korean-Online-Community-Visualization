var THREE = require('three');
var TrackballControls = require('three-trackballcontrols');
var text2D = require('three-text2d');
var TWEEN = require('tween.js');

module.exports = pixel;

/**
 * Expose to the outter world instance of three.js
 * so that they can use it if they need it
 */
module.exports.THREE = THREE;

var eventify = require('ngraph.events');


// load library files
var createNodeView = require('./../lib/nodeView.js');
var createEdgeView = require('./../lib/edgeView.js');
var createTooltipView = require('./../lib/tooltip.js');
var createAutoFit = require('./../lib/autoFit.js');
var createInput = require('./../lib/input.js');
var validateOptions = require('./../options.js');
var flyModule = require('./../lib/flyTo.js');
var flyTo = flyModule();

var makeActive = require('./../lib/makeActive.js');

function pixel(graph, options) {
  // This is our public API.
  var api = {
    /**
     * attempts to fit graph into available screen size
     */
    autoFit: autoFit,

    /**
     * Returns current layout manager
     */
    layout: getLayout,

    /**
     * Gets or sets value which indicates whether layout is stable. When layout
     * is stable, then no additional layout iterations are required. The renderer
     * will stop calling `layout.step()`, which in turn will save CPU cycles.
     *
     * @param {boolean+} stableValue if this value is not specified, then current
     * value of `isStable` will be returned. Otherwise the simulator stable flag
     * will be forcefully set to the given value.
     */
    stable: stable,

    /**
     * Gets or sets graph that is rendered now
     *
     * @param {ngraph.graph+} graphValue if this value is not specified then current
     * graph is returned. Otherwise renderer destroys current scene, and starts
     * render new graph.
     */
    graph: graphInternal,

    /**
     * Attempts to give keyboard input focus to the scene
     */
    focus: focus,

    /**
     * Requests renderer to move camera and focus on given node id.
     *
     * @param {string} nodeId identifier of the node to show
     */
    showNode: showNode,
    showNodeTWEEN: showNodeTWEEN,

    /**
     * Allows clients to provide a callback function, which is invoked before
     * each rendering frame
     *
     * @param {function} newBeforeFrameCallback the callback function. This
     * argument is not chained, and any new value overwrites the old one
     */
    beforeFrame: beforeFrame,

    /**
     * Returns instance of the three.js camera
     */
    camera: getCamera,

    /**
     * Allows clients to set/get current clear color of the scene (the background)
     *
     * @param {number+} color if specified, then new color is set. Otherwise
     * returns current clear color.
     */
    clearColor: clearColor,

    /**
     * Allows clients to set/get current clear color opacity
     *
     * @param {number+} alpha if specified, then new alpha opacity is set. Otherwise
     * returns current clear color alpha.
     */
    clearAlpha: clearAlpha,

    /**
     * Synonmim for `clearColor`. Sets the background color of the scene
     *
     * @param {number+} color if specified, then new color is set. Otherwise
     * returns current clear color.
     */
    background: clearColor,

    /**
     * Gets UI for a given node id. If node creation function decided not to
     * return UI for this node, falsy object is returned.
     *
     * @param {string} nodeId - identifier of the node
     * @returns Object that represents UI for the node
     */
    getNode: getNode,

    /**
     * Gets UI for a given link id. If link creation function decided not to
     * return UI for this link, falsy object is returned.
     *
     * @param {string} linkId - identifier of the link
     * @returns Object that represents UI for the link
     */
    getLink: getLink,

    /**
     * Iterates over every link UI element
     *
     * @param {Function} cb - link visitor. Accepts one argument, which is linkUI
     */
    forEachLink: forEachLink,

    /**
     * Iterates over every node UI element
     *
     * @param {Function} cb - node visitor. Accepts one argument, which is nodeUI
     */
    forEachNode: forEachNode,

    /**
     * Gets three.js scene where current graph is rendered
     */
    scene: getScene,


    /**
     * user defined functions
     */
    // setSelectedNode to active neighborhoods
    setSelectedNode: setSelectedNode,
    initLabels: initLabels,
    clearHtmlLabels: clearHtmlLabels,
    clearThreeLabels: clearThreeLabels,
    clearRemains: clearRemains



  };

    eventify(api);

  options = validateOptions(options);

  var beforeFrameCallback;
  var container = options.container;
  verifyContainerDimensions(container);

  var layout = options.createLayout(graph, options);
  if (layout && typeof layout.on === 'function') {
    layout.on('reset', layoutReset);
  }
  var isStable = false;
  var nodeIdToIdx = new Map();
  var edgeIdToIndex = new Map();


  var scene, camera, renderer;
  var nodeView, edgeView, autoFitController, input;
  var nodes, edges;
  var tooltipView = createTooltipView(container);

  var selectedNode;
  var originLinks = [];

  var labelsToShow = [];
  var labelsSprites = [];

  var TrackballController;

  var neighbors = [];

  var color_palette = ["#800000", "#800080", "#008000", "#000080", "#808000", "#804080", "#008080", "#808080", "#ff0dd0" ];




  init();
  run();
  focus();

  return api;

  function layoutReset() {
    initPositions();
    stable(false);
  }

  function getCamera() {
    return camera;
  }

  function clearColor(newColor) {
    newColor = normalizeColor(newColor);
    if (typeof newColor !== 'number') return renderer.getClearColor();

    renderer.setClearColor(newColor);
  }

  function clearAlpha(newAlpha) {
    if (typeof newAlpha !== 'number') return renderer.getClearAlpha();

    renderer.setClearAlpha(newAlpha);
  }

  function clearHtmlLabels(){
    labelsToShow.length = 0;
    tooltipView.deleteLabeltip();
  }

  function clearThreeLabels(){
      labelsToShow.length = 0;

      labelsSprites.forEach(function (sprite) {
        scene.remove( scene.getObjectByName(sprite.name));
      });

      labelsSprites.length = 0;

  }

  function clearRemains() {

      selectedNode = undefined;
      originLinks = [];
      neighbors = [];

      var dropdownDom = document.getElementById("neighborsList");
      // clean children of dropdown list
      while(dropdownDom.firstChild){
          dropdownDom.removeChild(dropdownDom.firstChild);
      }
      // change the title of dropdown list as the active node
      document.getElementById("neighborsBtn").firstChild.textContent = "";



  }

  function run() {
    requestAnimationFrame(run);

    if (beforeFrameCallback) {
      beforeFrameCallback();
    }
    if (!isStable) {
      isStable = layout.step();

      updatePositions();

      nodeView.update();
      edgeView.update();
    } else {
      // we may not want to change positions, but colors/size could be changed
      // at this moment, so let's take care of that:
      if (nodeView.needsUpdate()) nodeView.update();
      if (edgeView.needsUpdate()) edgeView.update();
    }

    if (isStable) api.fire('stable', true);

    input.update();

    if (autoFitController) {
      autoFitController.update();
      input.adjustSpeed(autoFitController.lastRadius());
    }

    var labelPositions = [];
    // ********* This code is for drawing label using ThreeJs *******************
    for(var i=0; i<labelsToShow.length; i++){
        var pos = getNode(labelsToShow[i].id).position;
        labelsSprites[i].position.set(pos.x, pos.y, pos.z+5);
    }
    // ********************************************************


    // ********* This code is for drawing label using HTML *******************
    // If you use this code using initLabelsHTML() and others

    // labelsToShow.forEach(function (node) {
    //     labelPositions.push(toScreenPosition(getNode(node.id).position));
    // });
    // 쓰레숄드 이상인 노드의 html 라벨 visible
    // tooltipView.showLabels(labelPositions);


    // 트랙볼컨트롤 업데이트.
    TrackballController.update();

    // TWEEEN 업데이트
    TWEEN.update();


    renderer.render(scene, camera);
  }



    // ********* This code is for drawing label using ThreeJs *******************
  function initLabels(degree) {
      graph.forEachNode(function (node) {
              if (node.data.size > degree) {
                  labelsToShow.push(
                      {
                          "id": node.id,
                          "label":node.data.label
                      }
                  );

                  var sprite = new text2D.SpriteText2D(node.data.label, {
                      align: text2D.textAlign.right,
                      font: '15px Arial', fillstyle: '#333', antialias: true
                  });
                  sprite.name = node.data.label;
                  labelsSprites.push(sprite);
                  scene.add(sprite);
              }
          });
    }

    // ********* This code is for drawing label using HTML *******************
  function initLabelsHTML(degree) {
      graph.forEachNode(function (node) {
          if(node.data.size > degree){
              labelsToShow.push(
                  {
                      "id": node.id,
                      "label":node.data.label
                  }
              );
          }
      });

      console.log(labelsToShow);
      tooltipView.createLabeltip(labelsToShow);

  }



  function getScene() {
    return scene;
  }

  function beforeFrame(newBeforeFrameCallback) {
    beforeFrameCallback = newBeforeFrameCallback;
  }

  function init() {
    initScene();
    initPositions();
    listenToGraph();

  }

  function listenToGraph() {
    // TODO: this is not efficient at all. We are recreating view from scratch on
    // every single change.
    graph.on('changed', initPositions);
  }

  function updatePositions() {
    if (!nodes) return;

    for (var i = 0; i < nodes.length; ++i) {
      var node = nodes[i];
      node.position = layout.getNodePosition(node.id);
    }
  }

  function initPositions() {
    edges = [];
    nodes = [];
    nodeIdToIdx = new Map();
    edgeIdToIndex = new Map();
    graph.forEachNode(addNodePosition);
    graph.forEachLink(addEdgePosition);

    nodeView.init(nodes);
    edgeView.init(edges);

    if (input) input.reset();

    function addNodePosition(node) {
      var nodeModel = options.node(node);
      if (!nodeModel) return;
      var idx = nodes.length;

      var position = layout.getNodePosition(node.id);
      if (typeof position.z !== 'number') position.z = 0;

      nodeModel.id = node.id;
      nodeModel.position = position;
      nodeModel.idx = idx;

      nodes.push(makeActive(nodeModel));

      nodeIdToIdx.set(node.id, idx);
    }

    function addEdgePosition(edge) {
      var edgeModel = options.link(edge);
      if (!edgeModel) return;

      var fromNode = nodes[nodeIdToIdx.get(edge.fromId)];
      if (!fromNode) return; // cant have an edge that doesn't have a node

      var toNode = nodes[nodeIdToIdx.get(edge.toId)];
      if (!toNode) return;

      edgeModel.idx = edges.length;
      edgeModel.from = fromNode;
      edgeModel.to = toNode;

      edgeIdToIndex.set(edge.id, edgeModel.idx);

      edges.push(makeActive(edgeModel));
    }
  }

  function initScene() {
    scene = new THREE.Scene();
    scene.sortObjects = false;

    camera = new THREE.PerspectiveCamera(75, container.clientWidth / container.clientHeight, 0.1, 20000);
    camera.position.x = 0;
    camera.position.y = 0;
    camera.position.z = 1000;

    // init other camera variables
    cameraPos0 = camera.position.clone();
    cameraUp0 = camera.up.clone();
    cameraZoom = camera.position.z;

    scene.add(camera);
    nodeView = createNodeView(scene);
    edgeView = createEdgeView(scene);


    // 트랙볼 컨트롤러 추가, (추가하게되면 원래 있던 wasd 컨트롤러는 무시됨) 2017.03.09
    TrackballController = new TrackballControls(camera, container);


    // 구 생성 테스트.
      /*
    var sphere_geometry = new THREE.SphereGeometry();
    var sphere_material = new THREE.MeshNormalMaterial();
    sphere = new THREE.Mesh( sphere_geometry, sphere_material);

    scene.add(sphere);
*/


    if (options.autoFit) autoFitController = createAutoFit(nodeView, camera);

    var glOptions = {
      antialias: false,
    };
    if (options.clearAlpha !== 1) {
      glOptions.alpha = true;
    }

    renderer = new THREE.WebGLRenderer(glOptions);

    renderer.setClearColor(options.clearColor, options.clearAlpha);
    renderer.setSize(container.clientWidth, container.clientHeight);
    container.appendChild(renderer.domElement);

    input = createInput(camera, graph, renderer.domElement);
    input.on('move', stopAutoFit);
    input.on('nodeover', setTooltip);
    input.on('nodeclick', showNeighbors);
    // input.on('nodeclick', passthrough('nodeclick'));
    input.on('nodedblclick', passthrough('nodedblclick'));


    window.addEventListener('resize', onWindowResize, false);
  }

  function getNode(nodeId) {
    var idx = nodeIdToIdx.get(nodeId);
    if (idx === undefined) return;

    return nodes[idx];
  }

  function getLink(linkId) {
    var idx = edgeIdToIndex.get(linkId);
    if (idx === undefined) return;

    return edges[idx];
  }

  function forEachLink(cb) {
    if (typeof cb !== 'function') throw new Error('link visitor should be a function');
    edges.forEach(cb);
  }

  function forEachNode(cb) {
    if (typeof cb !== 'function') throw new Error('node visitor should be a function');
    nodes.forEach(cb);
  }


  // node hovering effect
  function setTooltip(e) {
    // console.log("e's position");
    // console.log(e);
    var node = getNodeByIndex(e.nodeIndex);


    // console.log("node's position switched by the user defined function");
    // console.log(toScreenPosition(getNode(node.id).position));

    if (node !== undefined) {
      tooltipView.show(e, node);
    } else {
      tooltipView.hide(e);
    }
    // active neighborhood edges' color as red
    setSelectedNode(node);

    api.fire('nodehover', node);

  }

  function showNeighbors(e){

    var node;
    if(e.nodeIndex){
      node = getNodeByIndex(e.nodeIndex);
    }else if(e.id){
      node = e
    }else{
      return;
    }
    // if(node == undefined) return;

    // clean neighbors array
    neighbors.length = 0;

    // change the title of dropdown list as the active node
    document.getElementById("neighborsBtn").firstChild.textContent = node.data.label;

    var node_id = node.id;
    // add neighbors node to the array
    node.links.forEach(function (link) {

      var node;
      if(link.fromId != node_id){
        node = getNodeByIndex(link.fromId);
      }else if(link.toId != node_id){
        node = getNodeByIndex(link.toId);
      }
      neighbors.push(node);

    });

    // sort neighbors by modularity index
    neighbors.sort(function (a, b) {
        return a.data.module - b.data.module;
    });

    addNeighborsToHTML();
    addNeighborsClickEvent();
    addNeighborsHoverEvent();
  }

  function addNeighborsToHTML(){

    // open dropdownList
    // $('#neighborsBtn').click();
    $("#neighborsList").css("display", "block");
    if (window.matchMedia('(max-width: 700px)').matches){
        $("#neighborsList").css("display", "none");
    }


    // get dropdownList's DOM
    var dropdownDom = document.getElementById("neighborsList");

    // clean children of dropdown list
    while(dropdownDom.firstChild){
        dropdownDom.removeChild(dropdownDom.firstChild);
    }


    // iterate neighbors to write HTML
    neighbors.forEach(function (node) {

        var labelDom = document.createElement("li");
        var innerDom = document.createElement("a");
        var boxDom = document.createElement("span");


        // text dom
        innerDom.setAttribute("class", "neighbor");
        innerDom.setAttribute("href", "#");
        innerDom.textContent = node.data.label;
        labelDom.appendChild(innerDom);

        // box dom (modularity)
        boxDom.setAttribute("class", "box");
        boxDom.style.backgroundColor = color_palette[node.data.module]; // set color
        labelDom.appendChild(boxDom);

        // append li element to dropdownList
        dropdownDom.appendChild(labelDom);
        
    })
  }

  function addNeighborsClickEvent(){
    $(".neighbor").click(function () {
        var label = $(this).text();
        neighbors.forEach(function (node) {
            if(node.data.label == label){
                showNodeTWEEN(node.id);
                showNeighbors(node);
                return;

            }
        })
    });

  }

  function addNeighborsHoverEvent(){
        $(".neighbor").hover(function () {
            var label = $(this).text();
            neighbors.forEach(function (node) {
                if(node.data.label == label){
                    setSelectedNode(node);
                    return;
                }
            })
        });

  }

  function passthrough(name) {
    return function (e) {
      var node = getNodeByIndex(e.nodeIndex);
      if (node) api.fire(name, node);
    };
  }

  function getNodeByIndex(nodeIndex) {
    var nodeUI = nodes[nodeIndex];
    return nodeUI && graph.getNode(nodeUI.id);
  }

  function stopAutoFit() {
    input.off('move');
    autoFitController = null;
  }

  function onWindowResize() {
    camera.aspect = container.clientWidth / container.clientHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(container.clientWidth, container.clientHeight);

      // camera.aspect = window.innerWidth / window.innerHeight;
      // camera.updateProjectionMatrix();
      // renderer.setSize(window.innerWidth, window.innerHeight);
  }

  function autoFit() {
    if (autoFitController) return; // we are already auto-fitting the graph.
    // otherwise fire and forget autofit:
    createAutoFit(nodeView, camera).update();
  }

  function getLayout() {
    return layout;
  }

  function stable(stableValue) {
    if (stableValue === undefined) return isStable;
    isStable = stableValue;
    api.fire('stable', isStable);
  }

  function graphInternal(newGraph) {
    if (newGraph !== undefined) throw new Error('Not implemented, Anvaka, do it!');
    return graph;
  }

  function normalizeColor(color) {
    if (color === undefined) return color;
    var colorType = typeof color;
    if (colorType === 'number') return color;
    if (colorType === 'string') return parseStringColor(color);
    if (color.length === 3) return (color[0] << 16) | (color[1] << 8) | (color[2]);
    throw new Error('Unrecognized color type: ' + color);
  }

  function parseStringColor(color) {
    if (color[0] === '#') {
      return Number.parseInt(color.substring(1), 16);
    }
    return Number.parseInt(color, 16);
  }

  function focus() {
    var sceneElement = renderer && renderer.domElement;
    if (sceneElement && typeof sceneElement.focus === 'function') sceneElement.focus();
  }

  function showNode(nodeId, stopDistance) {
    stopDistance = typeof stopDistance === 'number' ? stopDistance : 500;
    flyTo.flyTo(camera, layout.getNodePosition(nodeId), stopDistance);

  }

  function showNodeTWEEN(nodeId, stopDistance) {
    console.log("hello")

      flyTo.flyTo_smooth(camera, getNode(nodeId).position);

  }

  // user defined function
  function changeEdgeActive() {
    originLinks.forEach(function (link) {
        getLink(link.id).fromColor = 0xFF0000;
    });

  }


  function setSelectedNode(node) {

    if (selectedNode !== undefined){
        // console.log("recover previous color from activated color");
        originLinks.forEach(function (link) {
            if(link.data.color){
                var tempLink = getLink(link.id);
                tempLink.fromColor = link.data.color;
                tempLink.toColor = 0x000000;

            }else{
                var tempLink = getLink(link.id);
                tempLink.fromColor = link.data.fromColor;
                tempLink.toColor = link.data.toColor;
            }

        });
        originLinks = [];
    }

    selectedNode = node;
    if (node !== undefined){

        node.links.forEach(function (link) {
            var tempLink = getLink(link.id);
            tempLink.fromColor = 0xFF0000;
            tempLink.toColor = 0xFF0000;

            // tempLink.fromColor = "#FFFF0000";
            // tempLink.toColor = "#FFFF0000";

            originLinks.push(link);

        });
    }
  }

  function toScreenPosition(position) {
      var vector = new THREE.Vector3();
      var canvas = renderer.domElement;

      vector.set( position.x, position.y, position.z);

      // map to normalized device coordinate (NDC) space
      vector.project( camera );

      // map to 2D screen space
      vector.x = Math.round( (   vector.x + 1 ) * canvas.width  / 2 );
      vector.y = Math.round( ( - vector.y + 1 ) * canvas.height / 2 );
      vector.z = 0;

      return vector;
  }

}

function verifyContainerDimensions(container) {
  if (!container) {
    throw new Error('container is required for the renderer');
  }

  if (container.clientWidth <= 0 || container.clientHeight <= 0) {
    console.warn('Container is not visible. Make sure to set width/height to see the graph');
  }
}
