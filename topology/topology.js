/**
 * Created by zctt on 2015/8/19.
 */

//这里是初始化
//Only Topology

//---------------------------------------变量声明开始---------------------------------------------------


//屏幕的宽度和高度以及边距
var winWidth = window.screen.width - 50
var winHeight = window.screen.height - 150
var margin = { top: -5, right: -5, bottom: -5, left: -5 },
    width = winWidth - margin.left - margin.right,
    height = winHeight - margin.top - margin.bottom;


var zoomRange = [0.2, 10];//地图缩放级别范围
var layerChangeRange={
    min:1,
    max:10
};

//当前页面的状态：1）Monitor 是监控 2）Editor  编辑
var pageMode="Editor";

var translate = null;//画布的当前位移距离

var scale = null;//画布的当前缩放比例

var imgPath = "../images/";//图片文件夹路径
var imgSize = 36;//拓扑节点的边长
//用于拖拽生成的网元缩略图尺寸
var elementImgSize=24;
var rootData=null;//服务端返回的拓扑数据

var enterFlag=false;
//拓扑必要的一些配置信息
var topologySettings={
    //服务地址
    //webServiceUrl:"../data/toplogy.json"
    webServiceUrl:"../data/levelTopology.json"
};
var _parentId="0";
var _currentLayerLevel=0;
//子网容器
var subNetContainer=null;
//设备节点容器
var nodesContainer=null;
//链路连接线容器
var linksContainer=null;
//界面上的所有节点
var nodesAll=null;

var zoomReset;


//---------------------------------------流程方法开始---------------------------------------------------
init();

//初始化顶部工具栏，绑定各个按钮的事件
function initToolbar(){
   /* d3.select("#btnReset").on("click", function () {
        zoom.scale(1);
        zoom.translate([0,0]);
        mainElementsContainer
            .transition()
            .duration(1000)
            .attr('transform',"translate(0,0) scale(1)");
    });*/

    d3.select("#btnReset").on("click", zoomReset);

    d3.select("#btnUpLevel").on("click", function () {
        changeLayerLevel(false,null);
    });
}

//初始化
function init(settings){
    //topologySettings=settings;

   var rootSVG = initSVG();
    if(pageMode =="Editor")
        initElementBar(rootSVG);
    initToolbar();
}


function getTopElementData(callBack){
    d3.json("../data/toolNetElement.json", function (error, topoData){
        callBack(topoData.elements);
    });
}

//绘制网元栏
function initElementBar(svgContainer){
    var elementContainer = svgContainer.append("g").attr('transform',"translate(3,3)");
    var elementPanelWidth=elementImgSize+2*8;
    //添加一个背景框
    elementContainer.append("rect")
        .attr("class","netElementForDragBackground")
        .attr("width",elementPanelWidth)
        .attr("height",elementImgSize*15);

    //获取网元相关的数据
    getTopElementData(function (elementDataArray) {
        //为数据添加x,y坐标
        for(var i=0;i<elementDataArray.length;i++){
            var elementNode=elementDataArray[i];
            elementNode.x=8;
            elementNode.ox=8;

            elementNode.y=i*elementImgSize +10*(i+1);
            elementNode.oy=i*elementImgSize +10*(i+1);
        }
    /*    elementContainer.selectAll(".netElementForBackground")
            .data(elementDataArray)
            .enter()
            .append("image")
            .attr("width", elementImgSize)
            .attr("height", elementImgSize)
            .attr("class", "netElementForBackground")
            .attr("xlink:href", getNetElementImage)
            .attr("x", function (d) {
                return d.x;
            })
            .attr("y",function(d){
                return  d.y;
            })*/

        //临时背景，用于在网元图标拖拽的时候作为面板的上背景显示
        var tempBackGround=null;

        elementContainer.selectAll(".netElementForDrag")
            .data(elementDataArray)
            .enter()
            .append("image")
            .attr("width", elementImgSize)
            .attr("height", elementImgSize)
            .attr("class", "netElementForDrag")
            .attr("xlink:href", getNetElementImage)
            .attr("x", function (d) {
                return d.x;
            })
            .attr("y",function(d){
                return  d.y;
            })
            .on('mouseover', function () {
                d3.select(this).attr("opacity", 0.5)
            })
            .on('mouseout', function () {
                d3.select(this).attr("opacity", 1)
            })
            .call(d3.behavior.drag()
                .origin(function (d) { return d; })
                .on("dragstart", function (d) {
                    console.log(d)
                    tempBackGround=elementContainer.append("image")
                        .attr("width", elementImgSize)
                        .attr("height", elementImgSize)
                        .attr("class", "netElementForDrag")
                        .attr("xlink:href", function () {
                            return getNetElementImage(d);
                        })
                        .attr("x", d.ox)
                        .attr("y", d.oy)
                })
                .on("drag", function (d) {
                    d.x = d3.event.x
                    d.y = d3.event.y
                    d3.select(this).attr("x", d3.event.x).attr("y", d3.event.y)
                })
                .on("dragend", function (d) {
                    //如果没有脱出网元面板的范围，则不生成节点，并且返回原来位置
                    if(d.x<=elementPanelWidth){
                        d3.select(this).attr("x", d.ox).attr("y", d.oy);
                        d.x= d.ox;
                        d.y= d.oy;
                        return;
                    }

                    //如果画布有过缩放或者平移，则重新计算新的坐标位置
                    var newX= d.x;
                    var newY= d.y;
                    if(scale!=null || translate !=null){
                        var x1= d.x-translate[0];
                        var y1= d.y-translate[1];
                        newX=x1/scale;
                        newY=y1/scale;
                    }

                    var newNode={
                      id:guid(),
                        name: d.title,
                        state:0,
                        x:newX,
                        y:newY,
                        deviceType: d.deviceType,
                        parentId:_parentId
                    };

                    var currentData= getCurrentLevelData();
                    currentData.nodes.push(newNode);
                    drawNodesElements(currentData);

                    //使拖放的网元回到网元面板的原来位置
                    d3.select(this).attr("x", d.ox).attr("y", d.oy);
                    d.x= d.ox;
                    d.y= d.oy;
                    tempBackGround.remove();
                }))
    });

}



//设定svg的宽度，高度以及覆盖层（防止内部的元素跑出svg）
//绘制必要的元素
function initSVG(){
    var svg =  d3.select("#mainSVG")
        //.attr("width", width)
        .attr("height", height)
        .attr("overflow", "hidden");

    //svg中添加箭头资源标示
    //insertArrowDef(svg);

    //设定画布缩放级别范围，缩放函数
    var zoom = d3.behavior.zoom()
        .scaleExtent(zoomRange)
        .on("zoom", zoomed);

    //声明画布中的根组，svg中的第一个g
    var mainCanvas = svg
        .append("g")
        .call(zoom)
        .on("dblclick.zoom", null);

    //为主画布添加背景
    mainCanvas.append("rect")
        .attr("width", width)
        .attr("height", height)
        .attr("x", 0)
        .attr("y", 0)
        .style("fill", "none")
        .style("pointer-events", "all")
        .on("dblclick", function () {
            changeLayerLevel(true,null);
        })

    //在主画布中添加主元素容器，所有的内容节点都在这个容器中！！！！！
    var mainElementsContainer = mainCanvas.append("g");

   zoomReset= function () {
       zoom.scale(1);
       zoom.translate([0,0]);
       mainElementsContainer
           .transition()
           .duration(1000)
           .attr('transform',"translate(0,0) scale(1)");
   }
    
    //缩放的具体函数
    function zoomedBak() {
        //初次进入下一个层级之后的标示，防止方法多次执行
        if(enterFlag){
            return;
        }
        if( d3.event.scale>=zoomRange[1]){
            if(_currentLayerLevel==2){
                mainElementsContainer.attr("transform", "translate(" + d3.event.translate + ") scale(" + d3.event.scale + ")");
                return;
            }
            enterFlag=true;
            //延迟1秒执行重置画布操作，防止鼠标滚轮的惯性捣乱
            //if(_currentLayerLevel==0)
            //    return;
            setTimeout(function () {
                if(enterFlag)
                    enterFlag=false;
                zoom.scale(1);
                zoom.translate([0,0]);
                mainElementsContainer
                    .transition()
                    .attr('transform',"translate(0,0) scale(1)");

                if(_currentLayerLevel<2){
                    _currentLayerLevel+=1;
                    drawLayerNodes();
                }
            },1000);
        }
        if(d3.event.scale<=zoomRange[0]){
            if(_currentLayerLevel==0){
                mainElementsContainer.attr("transform", "translate(" + d3.event.translate + ") scale(" + d3.event.scale + ")");
                return;
            }

            enterFlag=true;
            //延迟1秒执行重置画布操作，防止鼠标滚轮的惯性捣乱
            setTimeout(function () {
                if(enterFlag)
                    enterFlag=false;
                zoom.scale(1);
                zoom.translate([0,0]);
                mainElementsContainer
                    .transition()
                    .attr('transform',"translate(0,0) scale(1)");

                if(_currentLayerLevel>0){
                    _currentLayerLevel-=1;
                    drawLayerNodes();
                }
            },1000);
        }
        mainElementsContainer.attr("transform", "translate(" + d3.event.translate + ") scale(" + d3.event.scale + ")");
       /* translate = d3.event.translate;
        scale = d3.event.scale;
        if(scale>=layerChangeRange.max){
            //延迟几秒执行重置画布操作，防止鼠标滚轮的惯性捣乱
            setTimeout(function () {
                console.log("下一个图层");
                zoom.scale(1);
                zoom.translate([0,0]);
                mainElementsContainer
                    .transition()
                    .attr('transform',"translate(0,0) scale(1)");
                //绘制新的图层
                changeLayer("son");
            },3000);

        }
        if(scale<=layerChangeRange.min){
            console.log("上一个图层");
        }*/
        //zooming(d3.event.scale);
    }

    function zoomed(){
        translate = d3.event.translate;
        scale = d3.event.scale;
        mainElementsContainer.attr("transform", "translate(" + d3.event.translate + ") scale(" + d3.event.scale + ")");
    }

    //设备节点容器，链路节点容器初始化
    linksContainer=mainElementsContainer.append("g");
    nodesContainer=mainElementsContainer.append("g");

    getTopologyData(function (data) {
       //得到了返回的拓扑数据
        rootData=data;
        //console.log(data);
       //对返回的数据做处理
       // zooming(null);
        //绘制当前层级的拓扑，节点和链路
        drawLayerNodes();
    });

    return svg;
}

//根据层的级别绘制节点和链路
function drawLayerNodes(){
    var currentLevelData=rootData[_currentLayerLevel.toString()];
    if(currentLevelData==undefined || currentLevelData.nodes==undefined)
        return;

    drawLinks(currentLevelData);
    drawNodesElements(currentLevelData);
}

function drawLayerNodesWithParnet(parentNode){
    var currentLevelData=rootData[_currentLayerLevel.toString()];
    if(currentLevelData==undefined || currentLevelData.nodes==undefined)
        return;

    var subNodesArray=Enumerable.From(currentLevelData.nodes)
        .Where("$.parentId =='"+parentNode.id+"'")
        .ToArray();
    drawLinks(subNodesArray);
    drawNodesElements({"nodes":subNodesArray});
}

//绘制链路连接线
function drawLinks(currentLevelData){

    linksContainer.selectAll(".link").remove();

    if(currentLevelData.links==undefined || currentLevelData.links.length==0)
        return;
    currentLevelData.links.forEach(function (d) {
        if(typeof d.source !="object")
            d.source=findDeviceById(d.source,currentLevelData);
        if(typeof  d.target !="object")
            d.target=findDeviceById(d.target,currentLevelData);
    });

    linksContainer.selectAll(".link")
        .data(currentLevelData.links)
        .enter()
        .append("line")
        .attr("class","link")
        .attr("x1",function(d){return getNodeCenter(d.source).x;})
        .attr("y1",function(d){return getNodeCenter(d.source).y;})
        .attr("x2",function(d){return getNodeCenter(d.target).x;})
        .attr("y2",function(d){return getNodeCenter(d.target).y;});

}

//改变图层绘制


function zooming(newScale){
    var levelData=getNodeDataFromZooming(newScale);
    drawNodesElements(levelData);
}

//绘制子网
function drawSubnets(mainElementsContainer){
    //所有子网的容器
    subNetContainer=mainElementsContainer.append("g");
    var subNetsAll =  subNetContainer.selectAll(".subNet")
        .data(rootData.nodes)
        .enter()
        .append("g")
        .attr("class","subNet")
        .attr("transform", function(d) { return "translate(" + d.x + "," + d.y + ")"; })
        .call(d3.behavior.drag()
            .origin(function(d) { return d; })
            .on("dragstart", function (d) {
                this.parentNode.appendChild(this);
                d3.event.sourceEvent.stopPropagation();
            })
            .on("drag", function (d) {
                d3.select(this).attr("transform", "translate(" + (d.x = d3.event.x) + "," + (d.y = d3.event.y) + ")");
            }));

    //添加设备图片
    subNetsAll.append("image")
        .attr("width", imgSize)
        .attr("height", imgSize)
        .attr("class", "nodeImg")
        .attr("xlink:href", getSubnetImage);
    //.on('mouseover', tip.show)
    //.on('mouseout', tip.hide)

    //添加设备文字
    subNetsAll.append("text")
        .attr("class","nodeText")
        .text(function(d){return d.name;})
        .attr("dy", imgSize +13);

}

//根据传递过来的数据绘制子网的网元设备节点
function drawNodesElements(nodesData){
    if(nodesAll!=null)
         nodesAll.remove();
   nodesAll =  nodesContainer.selectAll(".node")
        .data(nodesData.nodes)
        .enter()
        .append("g")
        .attr("class","node")
        .attr("transform", function(d) { return "translate(" + d.x + "," + d.y + ")"; })
        .call(d3.behavior.drag()
            .origin(function(d) { return d; })
            .on("dragstart", function (d) {
              this.parentNode.appendChild(this);
              d3.event.sourceEvent.stopPropagation();

          })
            .on("drag", function (d) {
              d3.select(this).attr("transform", "translate(" + (d.x = d3.event.x) + "," + (d.y = d3.event.y) + ")");
               //更改和这个节点相关的连接线的起始位置
               linksContainer.selectAll(".link")
                   .filter(function (l) {
                       return l.source===d;
                   })
                   .attr("x1", d.x + imgSize/2)
                   .attr("y1", d.y+ imgSize/2);

               linksContainer.selectAll(".link")
                   .filter(function (l) {
                       return l.target===d;
                   })
                   .attr("x2", d.x+ imgSize/2)
                   .attr("y2", d.y+ imgSize/2);
          })
           .on("dragend", function (d) {

           }));

    //添加设备图片
    nodesAll.append("image")
        .attr("width", imgSize)
        .attr("height", imgSize)
        .attr("class", "nodeImg")
        .attr("xlink:href", getDeviceImage)
        .on('dblclick', function (d) {

            //双击节点，进入他的下一个级别的拓扑
          /*  _currentLayerLevel+=1;
            var currentLevelData=rootData[_currentLayerLevel.toString()];
            if(currentLevelData==undefined || currentLevelData.nodes==undefined){
                alert("没有要显示的下一个级别");
                _currentLayerLevel-=1;
                return;
            }

            drawLayerNodesWithParnet(d);*/
            changeLayerLevel(true,d);
        })
        //.on('mouseout', tip.hide)

    //添加设备文字
    nodesAll.append("text")
        .attr("class","nodeText")
        .text(function(d){return d.name;})
        .attr("dy", imgSize +13)
        .attr("dx", function (d) {
            return (imgSize - (12 * (d.name.length))) *0.5;
        })

}

//获取拓扑数据
function getTopologyData(callBack){
    d3.json(topologySettings.webServiceUrl, function (error, topoData) {
        //如果有错误，打印错误日志
        if (error) {
            return console.log(error);
        }
        //回调
        callBack(topoData);
    });
}




//---------------------------------------辅助方法开始---------------------------------------------------


function getNetElementImage(d) {
    switch (d.deviceType){
        case 1:
            return imgPath+"computerGroup.png";
        case  2:
            return imgPath+"comGrp.png";
        case  3:
            return imgPath+"serverBase.png";
        case  4:
            return imgPath+"terminal1.png";
        case  5:
            return imgPath+"globe.png";
        case  6:
            return imgPath+"green.png";
        case  7:
            return imgPath+"terminal3.png";
    }
    return "";
}

//通过缩放来得到对应的层级数据
function getNodeDataFromZooming(newScale){
    var result={
        "nodes":null,
        "links":null
    };
    if(scale==null){//初始状态
        var lev1s=Enumerable.From(rootData.nodes)
            .Where("$.parentId =='0'")
            .ToArray();
        result.nodes=lev1s;
    }
    else{

    }
    return result;
}

function getParentsDataFromSons(){
    var result={
        "nodes":null,
        "links":null
    };
}

function getSonDataFromParents(parentsArray){
    var result={
        "nodes":[],
        "links":null
    };
    for(var i=0;i<parentsArray.length;i++){
        var parentId=parentsArray[i];
        var sons=Enumerable.From(rootData.nodes)
            .Where("$.parentId =='"+parentId+"'")
            .ToArray();
        if(sons.length>0)
            result.nodes= result.nodes.concat(sons);
    }
    return result;
}


//添加箭头资源
function insertArrowDef(svg) {
    var defs = svg.append("defs");
    var arrowMarker = defs.append("marker")
        .attr("id", "arrow")
        .attr("markerUnits", "strokeWidth")
        .attr("markerWidth", "12")
        .attr("markerHeight", "12")
        .attr("viewBox", "0 0 12 12")
        .attr("refX", "6")
        .attr("refY", "6")
        .attr("orient", "auto");
    var arrow_path = "M2,2 L10,6 L2,10 L6,6 L2,2";
    arrowMarker.append("path")
        .attr("d", arrow_path)
        .attr("fill", "#000000");
}


//根据设备的类型返回不同的图片
function getDeviceImage(d) {

    if (d.deviceType == 1)
        return imgPath + "dataBaseServer.png";
    else if (d.deviceType == 2)
        return imgPath + "serverBase.png";
    else if (d.deviceType == 3)
        return imgPath + "exchange.png";
    else if (d.deviceType == 4)
        return imgPath + "cloud.png";
    else if (d.deviceType == 5)
        return imgPath + "fireWall.png";
    else if (d.deviceType == 6)
        return imgPath + "terminal1.png";
    else if (d.deviceType == 7)
        return imgPath + "terminal2.png";
    else if(d.deviceType == 0)
        return imgPath + "computerGroup.png";
    else if(d.deviceType == -1)
         return imgPath + "comGrp.png";
    return "";
}

function getSubnetImage(d){
    switch(d.deviceType){

    }
    return imgPath +"computerGroup.png";
}

//重新组织数据源，以子网第一级别，每个子网中有包含的多个节点
function orgnizeTopoData(data){

    var subNets=Enumerable.From(data.nodes)
        .Where("$.parentId =='0'")
        .ToArray();

    for(var i=0;i<subNets.length;i++){
        var allNodes=Enumerable.From(data.nodes)
            .Where("$.parentId =='"+subNets[i].id+"'")
            .ToArray();
        if(allNodes.length>0)
            subNets[i].children=allNodes;
    }

    return {
        "nodes":subNets,
        "links":data.links
    };
}

//生成唯一id
function guid() {
    function S4() {
        return (((1 + Math.random()) * 0x10000) | 0).toString(16).substring(1);
    }
    return (S4() + S4() + "-" + S4() + "-" + S4() + "-" + S4() + "-" + S4() + S4() + S4());
}


//辅助方法，根据连接线指定的设备id找到对应的设备
function findDeviceById(id, topodata) {

    var device = null;
    for (var i = 0; i < topodata.nodes.length; i++) {
        if (topodata.nodes[i].id == id) {
            device = topodata.nodes[i];
            break;
        }
    }
    return device;
}

function getNodeCenter(node){
    return {
        x:node.x+imgSize/2,
        y:node.y+imgSize/2
    };
}


function getEndPosition(node){

}

function getStartPosition(node){

}

function changeLayerLevel(isDown,parentNode){
    var tempKey=_currentLayerLevel;
    if(isDown)
        tempKey+=1;
    else
        tempKey-=1;
    var currentLevelData=rootData[tempKey.toString()];
    if(currentLevelData==undefined || currentLevelData.nodes==undefined){
        alert("没有要显示的下一个级别");
        return;
    }
    _currentLayerLevel=tempKey;
    if(parentNode!=null)
        drawLayerNodesWithParnet(parentNode);
    else
        drawLayerNodes();
}

//获取当前的层级数据
function getCurrentLevelData(){
    var currentLevelData=rootData[_currentLayerLevel.toString()];
    if(currentLevelData==undefined || currentLevelData.nodes==undefined){
        return null;
    }
    return currentLevelData;
}