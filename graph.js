var width = 60,
    height = 20;

var force = d3.layout.force()
  .size([width, height])
  .charge(-400)
  .linkDistance(60)
  .on("tick", tick);

var svg = d3.select("body").append("svg")
  .attr("id", "canvas")
  .attr("width", width + "em")
  .attr("height", height + "em");

var link = svg.selectAll(".link"),
    node = svg.selectAll(".node");

function tick() {
}

function getIndex(nodes, id) {
  for (var i = 0; i < nodes.length; i++) {
    if (nodes[i].id == id)
      return i;
  }
}

// transform the coordinates from the JSON file to meaningful coordinates on the canvas
function transform(x, y) {
  return [10 + 6 * x, height / 2 - 6 * y]; // TODO make this an object with .x and .y?
}

d3.json("format.json", function(error, graph) {
  console.log(error);

  // process the links to the D3 format with indices
  for (var i = 0; i < graph.links.length; i++) { // TODO can be improved using the preprocessing used later
    graph.links[i].target = getIndex(graph.nodes, graph.links[i].coarser)
    graph.links[i].source = getIndex(graph.nodes, graph.links[i].finer)
  }

  // make sure the force-directedness is turned off
  for (var i = 0; i < graph.nodes.length; i++)
    graph.nodes[i].fixed = true;

  var topologies = [];

  // preprocess the topologies for easier access
  for (var i = 0; i < graph.nodes.length; i++)
    topologies[graph.nodes[i].id] = graph.nodes[i];

  // process the relations between topologies
  for (id in topologies) {
    // we look for all finer topologies
    var finer = [id];
    topologies[id].finer = [];

    while (finer.length > 0) {
      topology = finer.pop();

      for (var i = 0; i < graph.links.length; i++) {
        if (graph.links[i].coarser == topology) {
          if (topologies[id].finer.indexOf(graph.links[i].finer) == -1)
            topologies[id].finer.push(graph.links[i].finer);

          finer.push(graph.links[i].finer)
        }
      }
    }

    // we look for all coarser topologies
    var coarser = [id];
    topologies[id].coarser = [];

    while (coarser.length > 0) {
      topology = coarser.pop();

      for (var i = 0; i < graph.links.length; i++) {
        if (graph.links[i].finer == topology) {
          if (topologies[id].coarser.indexOf(graph.links[i].coarser) == -1)
            topologies[id].coarser.push(graph.links[i].coarser);

          coarser.push(graph.links[i].coarser)
        }
      }
    }
  }

  // create the passports for each topology
  for (id in topologies) {
    var topology = topologies[id];

    var passport = $("<div class='invisible passport' id='" + topology.id + "' data-topology='" + topology.id + "'></div>"); // TODO can we remove the id?
    passport.append("<h2><span class='symbol'>$" + topology.symbol + "$</span> " + topology.name + "</h2>");

    var dl = $("<dl></dl>");
    if ("generated" in topology) {
      dl.append("<dt>generated by");
      dl.append("<dd>" + topology.generated);
    }
    if ("refining" in topology) {
      dl.append("<dt>refining</dt>");
      dl.append("<dd>" + topology.refining); // TODO use MathJax here (not SVG, so okay)
    }

    function createComparisonList(topology, list) {
      var ul = $("<ul class='comparison-list'></ul>");
      for (var j = 0; j < list.length; j++)
        ul.append("<li><a href='#'>" + list[j] + "</a>"); // TODO display both abbreviation and full name, or at least the symbol (= use MathJax)
        // TODO hovering in this list should active the same event as hovering in a fixed situation (i.e. indicate the node by a border)
        // TODO clicking in this list should activate the clicked topology

      return ul;
    }

    dl.append("<dt>coarser than</dt>");
    if (topology.finer.length == 0) // I admit, this is a confusing name
      dl.append("<dd><span class='nothing'>nothing</span>");
    else 
      dl.append($("<dd>").append(createComparisonList(topology, topology.finer)));

    dl.append("<dt>finer than</dt>");
    if (topology.coarser.length == 0) // I admit, this is a confusing name
      dl.append("<dd><span class='nothing'>nothing</span>");
    else 
      dl.append($("<dd>").append(createComparisonList(topology, topology.coarser)));

    dl.appendTo(passport);
    
    passport.appendTo("body");
  }

  force
    .nodes(graph.nodes)
    .links(graph.links)
    .start();

  link = link.data(graph.links)
    .enter().append("line")
    .attr("class", "link")
    .attr("x1", function(d) { return transform(d.source.x, d.source.y)[0] + "em"; })
    .attr("y1", function(d) { return transform(d.source.x, d.source.y)[1] + "em"; })
    .attr("x2", function(d) { return transform(d.target.x, d.target.y)[0] + "em"; })
    .attr("y2", function(d) { return transform(d.target.x, d.target.y)[1] + "em"; })

  node = node.data(graph.nodes)
    .enter()
    .append("rect")
    .attr("data-topology", function(d) { return d.id; })
    .attr("x", function(d) { return (transform(d.x, d.y)[0] - 1.5) + "em"; })
    .attr("y", function(d) { return (transform(d.x, d.y)[1] - .9) + "em"; })
    .attr("width", "3em")
    .attr("height", "1.6em" )
    .attr("fixed", "true")
    .on("mouseover", mouseOverTopology)
    .on("mouseout", mouseOutTopology)
    .on("click", clickTopology)

  var text = svg.append("g").selectAll("text").data(graph.nodes)
    .enter()
    .append("text")
    .attr("id", function(d) { return "text-" + d.id; })
    .attr("x", function(d) { return transform(d.x, d.y)[0] + "em"; })
    .attr("y", function(d) { return (transform(d.x, d.y)[1] + .3) + "em"; })
    .text(function(d) { return d.id }) // TODO it seems to be hard to use MathJax inside SVG...
    .on("mouseover", mouseOverTopology)
    .on("mouseout", mouseOutTopology)
    .on("click", clickTopology)
  
  MathJax.Hub.Queue(["Typeset", MathJax.Hub]);
});

/* events */
var isFixed = false;
var fixedPassport = undefined;

/* TODO suggested naming
 * fixPassport
 * unfixPassport
 * activateTopology
 * deactivateTopology
 * 
 * and then the events call the correct thing
 */

// ...
function mouseOverTopology(topology) {
  // draw a border
  // TODO

  // if we have clicked on an element in the graph we fix the layout
  if (isFixed)
    return;
    // TODO if another node is fixed we should still highlight the current node in a different way
    // TODO and fix the cursor too

  // make the current node in the graph active
  $("rect[data-topology=" + topology.id + "]").attr("class", "active");

  // hide all passports except for this one
  $("div").attr("class", "passport invisible");
  $("div[data-topology=" + topology.id + "]").attr("class", "passport visible");

  for (var i = 0; i < topology.coarser.length; i++)
    $("rect[data-topology=" + topology.coarser[i] + "]").attr("class", "coarser");
  for (var i = 0; i < topology.finer.length; i++)
    $("rect[data-topology=" + topology.finer[i] + "]").attr("class", "finer");
}

function mouseOutTopology() {
  // remove the border
  // TODO

  // if we have clicked on an element in the graph we fix the layout
  if (isFixed)
    return;

  $("div").attr("class", "passport invisible");
  $("rect").attr("class", "");
}

function clickTopology(topology) {
  // TODO the clicked node should also be visible (as we can click on a node while it will remain active)
  if (isFixed) {
    // we might wish to modify the layout, hence we unfix things
    isFixed = false;

    // reset the styling, regardless
    mouseOutTopology();
    mouseOverTopology(topology);

    if (fixedPassport != topology.id) {
      isFixed = true;
      fixedPassport = topology.id;
    }
  }
  else {
    isFixed = true;
    fixedPassport = topology.id;
  }
}
