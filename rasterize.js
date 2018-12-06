/* GLOBAL CONSTANTS AND VARIABLES */

/* assignment specific globals */
const WIN_Z = 0;  // default graphics window z coord in world space
const WIN_LEFT = 0; const WIN_RIGHT = 1;  // default left and right x coords in world space
const WIN_BOTTOM = 0; const WIN_TOP = 1;  // default top and bottom y coords in world space
const INPUT_TRIANGLES_URL = "http://localhost:8000/triangles.json";
//"https://ncsucgclass.github.io/prog4/triangles.json"; // triangles file loc
const INPUT_ELLIPSOIDS_URL = "https://pages.github.ncsu.edu/cgclass/exercise5/ellipsoids.json"; // ellipsoids file loc

//Default Eye and Light positions
var Eye = new vec3.fromValues(0.5,0.5,-0.5); // default eye position in world space
var Light = new vec3.fromValues(0, 0.5, -0.5);

//Default lookAt and up
var lookAt = new vec3.fromValues(0, 0, 1);
var lookAtP = new vec3.fromValues(0.5, 0.5, 0);
var up = new vec3.fromValues(0.0, 1.0, 0.0);

//Original system values
var origin = new vec3.fromValues(0,0,0);
var origin_lookAtP = new vec3.fromValues(0,0,-1);
var origin_up = new vec3.fromValues(0,1,0);

//Transformation system variables to origin
var origin_t= new vec3.fromValues(0,0,0);
var origin_tlookAtP = vec3.fromValues(0,0,0);
var origin_tup = new vec3.fromValues(0,0,0);
//original values

/* input globals */
var inputTriangles; // the triangles read in from json
var numTriangleSets = 0; // the number of sets of triangles
var triSetSizes = []; // the number of triangles in each set
var sortedTriangleSets = []; //sorted triangle sets

/* webgl globals */
var gl = null; // the all powerful gl object. It's all here folks!
var vertexBuffers = []; // this contains vertex coordinates in triples, organized by tri set
var triangleBuffers = []; // this contains indices into vertexBuffers in triples, organized by tri set
var vertexNormalBuffers = []; //this contains vertex normals in triplets 
var vertexUVBuffers= []; //this contains uvs in doubles

//location of attributes
var vertexPositionAttrib; // where to put position for vertex shader
var vertexNormalAttrib;
var vertexUVAttrib;
var vertexMode;
var vertexAmbient;
var vertexDiffuse;
var vertexSpecular;
var vertexExp;

//Uniform locations
var vertexEye;
var vertexLight;
var vertexUSampler;
var lightModelULoc;
var uAlphaULoc;

//location of uniform
var modelMatrixULoc; // where to put the model matrix for vertex shader
var viewMatrixULoc; //view matrix location
var perspectiveMatrixULoc;  //perpective matrix location
var normalMatrixULoc;

//Triangle selection
var triangleSelection = [];
var triangleSelection_index = -1;

//lightModel Selection
var lightModel = 1;

//global matrices
var viewMat;
var pMat;

//Main snake
var snake_length=3;
var snake_o_x = [0.3, 0.2, 0.1];
var snake_o_y = [0.1, 0.1, 0.1];
var snake_z = 0.4;

var snake_vertex= [];
var snake_indice= [];

//NP snake
var npsnake_length=3;
var npsnake_x = [0.6, 0.7, 0.8];
var npsnake_y = [0.6, 0.6, 0.6];
var npsnake_z = 0.4;

var npsnake_vertex= [];
var npsnake_indice= [];

var food_vertex = [];

var food_o_x = 0.6;
var food_o_y = 0.6;
var food_z = 0.4;

var fps=5;
var render_id;

//snake direction
// 0: Up 
// 1: Right
// 2: Down
// 3: Left
var dir = 1;
var np_dir = 1;
var c_dir=0;

//textures
var snakeTexture;
var foodTexture;
var npsnakeTexture;
var textures = []; //this contains textures for each triangle set

// ASSIGNMENT HELPER FUNCTIONS

// get the JSON file from the passed URL
function getJSONFile(url,descr) {
    try {
        if ((typeof(url) !== "string") || (typeof(descr) !== "string"))
            throw "getJSONFile: parameter not a string";
        else {
            var httpReq = new XMLHttpRequest(); // a new http request
            httpReq.open("GET",url,false); // init the request
            httpReq.send(null); // send the request
            var startTime = Date.now();
            while ((httpReq.status !== 200) && (httpReq.readyState !== XMLHttpRequest.DONE)) {
                if ((Date.now()-startTime) > 3000)
                    break;
            } // until its loaded or we time out after three seconds
            if ((httpReq.status !== 200) || (httpReq.readyState !== XMLHttpRequest.DONE))
                throw "Unable to open "+descr+" file!";
            else
                return JSON.parse(httpReq.response); 
        } // end if good params
    } // end try    
    
    catch(e) {
        console.log(e);
        return(String.null);
    }
} // end get input json file

// set up the webGL environment
function setupWebGL() {

    //create image canvas
    var imageCanvas = document.getElementById("myImageCanvas");
    var cw = imageCanvas.width;
    var ch = imageCanvas.height;
     imageContext = imageCanvas.getContext("2d");

    var bgImage = new Image();
    bgImage.crossOrigin = "Anonymous";
    bgImage.src = "http://localhost:8000/bg.jpg";

    bgImage.onload = function()
    {
        var iw = bgImage.width;
        var ih = bgImage.height;
        imageContext.drawImage(bgImage, 0, 0, iw, ih, 0, 0, cw, ch);
    }

    // Get the webglcanvas and context
    var webglCanvas = document.getElementById("myWebGLCanvas"); // create a js canvas
    gl = webglCanvas.getContext("webgl"); // get a webgl object from it
    
    try {
      if (gl == null) {
        throw "unable to create gl context -- is your browser gl ready?";
      } else {
        //gl.clearColor(0.0, 0.0, 0.0, 1.0); // use black when we clear the frame buffer
        gl.clearDepth(1.0); // use max when we clear the depth buffer
        gl.enable(gl.DEPTH_TEST); // use hidden surface removal (with zbuffering)
      }
    } // end try
    
    catch(e) {
      console.log(e);
    } // end catch
 
} // end setupWebGL

// read triangles in, load them into webgl buffers
function loadTriangles() {
    inputTriangles = getJSONFile(INPUT_TRIANGLES_URL,"triangles");

    if (inputTriangles != String.null) { 
        var whichSetVert; // index of vertex in current triangle set
        var whichSetTri; // index of triangle in current triangle set
        var vtxToAdd; // vtx coords to add to the coord array
        var triToAdd; // tri indices to add to the index array
        var nToAdd; //normals to add to normals array
        var uvToAdd; //uvs to add to uv array

        // for each set of tris in the input file
        numTriangleSets = inputTriangles.length;
        for (var whichSet=0; whichSet<numTriangleSets; whichSet++) {
            
            // set up the vertex coord array
            inputTriangles[whichSet].coordArray = []; // create a list of coords for this tri set
            inputTriangles[whichSet].normalArray = []; // create a list of normals for this tri set
            inputTriangles[whichSet].uvArray = []; //create a list of uvs for this tri set

            inputTriangles[whichSet].Ka = inputTriangles[whichSet].material.ambient;
            inputTriangles[whichSet].Kd = inputTriangles[whichSet].material.diffuse;
            inputTriangles[whichSet].Ks = inputTriangles[whichSet].material.specular;
            inputTriangles[whichSet].n = inputTriangles[whichSet].material.n;
            inputTriangles[whichSet].alpha = inputTriangles[whichSet].material.alpha;

            inputTriangles[whichSet].mMatrix = mat4.create();
            inputTriangles[whichSet].nMatrix = mat4.create();

            triangleSelection.push(0);

            //console.log("values:"+ inputTriangles[whichSet].alpha);

            for (whichSetVert=0; whichSetVert<inputTriangles[whichSet].vertices.length; whichSetVert++) {
                
                vtxToAdd = inputTriangles[whichSet].vertices[whichSetVert];
                inputTriangles[whichSet].coordArray.push(vtxToAdd[0],vtxToAdd[1],vtxToAdd[2]);

                nToAdd = inputTriangles[whichSet].normals[whichSetVert];
                inputTriangles[whichSet].normalArray.push(nToAdd[0], nToAdd[1], nToAdd[2]);

                uvToAdd = inputTriangles[whichSet].uvs[whichSetVert];
                inputTriangles[whichSet].uvArray.push(uvToAdd[0], uvToAdd[1]);
            } // end for vertices in set

            // send the vertex coords to webGL
            vertexBuffers[whichSet] = gl.createBuffer(); // init empty vertex coord buffer for current set
            gl.bindBuffer(gl.ARRAY_BUFFER,vertexBuffers[whichSet]); // activate that buffer
            gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(inputTriangles[whichSet].coordArray),gl.STATIC_DRAW); // coords to that buffer

            //send vertex normals to webGL
            vertexNormalBuffers[whichSet] = gl.createBuffer();
            gl.bindBuffer(gl.ARRAY_BUFFER, vertexNormalBuffers[whichSet]);
            gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(inputTriangles[whichSet].normalArray),gl.STATIC_DRAW);

            //send uvs to webgl
            vertexUVBuffers[whichSet] = gl.createBuffer();
            gl.bindBuffer(gl.ARRAY_BUFFER, vertexUVBuffers[whichSet]);
            gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(inputTriangles[whichSet].uvArray), gl.STATIC_DRAW);

            // set up the triangle index array, adjusting indices across sets
            inputTriangles[whichSet].indexArray = []; // create a list of tri indices for this tri set
            triSetSizes[whichSet] = inputTriangles[whichSet].triangles.length;
            
            for (whichSetTri=0; whichSetTri<triSetSizes[whichSet]; whichSetTri++) 
            {
                triToAdd = inputTriangles[whichSet].triangles[whichSetTri];
                inputTriangles[whichSet].indexArray.push(triToAdd[0],triToAdd[1],triToAdd[2]);
                //console.log("values:"+ inputTriangles[whichSetTri].indexArray);
            } // end for triangles in set

            // send the triangle indices to webGL
            triangleBuffers[whichSet] = gl.createBuffer(); // init empty triangle index buffer for current tri set
            gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, triangleBuffers[whichSet]); // activate that buffer
            gl.bufferData(gl.ELEMENT_ARRAY_BUFFER,new Uint16Array(inputTriangles[whichSet].indexArray),gl.STATIC_DRAW); // indices to that buffer
        } // end for each triangle set 
    } // end if triangles found
} // end load triangles

// setup the webGL shaders
function setupShaders() {
    
    // define fragment shader in essl using es6 template strings
    var fShaderCode = `
        precision mediump float; 
        
        uniform vec3 Ka;
        uniform vec3 Kd;
        uniform vec3 Ks;
        uniform float n;

        uniform vec3 lightPosition;
        uniform vec3 eyePosition;
        uniform sampler2D uSampler;

        varying vec3 P;
        varying vec3 N;
        varying vec2 UV;

        uniform int lightModel;
        uniform float uAlpha;


        void main(void) {

            vec3 L = normalize(lightPosition - P);

            float lambertian = max(dot(N,L),0.0);

            vec3 V = normalize(eyePosition - P);
            
            vec3 R = normalize(N);

            float specular = 0.0;
            
            //Blinn-Phong
            vec3 H = normalize(V+L);
            specular = pow(max(dot(H,N),0.0),n);

            vec3 color = Ka + Kd*lambertian + Ks*specular;

            if(lightModel == 1)
            {   
                //use light and transparency
                vec4 texelColor = texture2D(uSampler, UV);
                gl_FragColor = vec4(texelColor.rgb * color, texelColor.a * uAlpha);
            }
            else
            {
                //don't use light
                gl_FragColor = texture2D(uSampler, UV);
            }
        }
    `;
    
    // define vertex shader in essl using es6 template strings
    var vShaderCode = `
        attribute vec3 vertexPosition;
        attribute vec3 vertexNormal;
        attribute vec2 vertexUV;

        uniform mat4 uModelMatrix; 
        uniform mat4 uViewMatrix; 
        uniform mat4 uPerpectiveMatrix;
        uniform mat4 uNormalMatrix;

        varying vec3 P;
        varying vec3 N;
        varying vec2 UV;

        void main(void) {
            vec4 position = uModelMatrix * vec4(vertexPosition, 1.0); 
            N = normalize(vertexNormal);
            P = vec3(position);
            N = normalize(vec3(uNormalMatrix * vec4(N, 0.0)));

            UV = vertexUV;

            gl_Position = uViewMatrix * vec4(P, 1.0);

            gl_Position = uPerpectiveMatrix * gl_Position;
        }
    `;
    
    try {
        // console.log("fragment shader: "+fShaderCode);
        var fShader = gl.createShader(gl.FRAGMENT_SHADER); // create frag shader
        gl.shaderSource(fShader,fShaderCode); // attach code to shader
        gl.compileShader(fShader); // compile the code for gpu execution

        // console.log("vertex shader: "+vShaderCode);
        var vShader = gl.createShader(gl.VERTEX_SHADER); // create vertex shader
        gl.shaderSource(vShader,vShaderCode); // attach code to shader
        gl.compileShader(vShader); // compile the code for gpu execution
            
        if (!gl.getShaderParameter(fShader, gl.COMPILE_STATUS)) { // bad frag shader compile
            throw "error during fragment shader compile: " + gl.getShaderInfoLog(fShader);  
            gl.deleteShader(fShader);
        } else if (!gl.getShaderParameter(vShader, gl.COMPILE_STATUS)) { // bad vertex shader compile
            throw "error during vertex shader compile: " + gl.getShaderInfoLog(vShader);  
            gl.deleteShader(vShader);
        } else { // no compile errors
            var shaderProgram = gl.createProgram(); // create the single shader program
            gl.attachShader(shaderProgram, fShader); // put frag shader in program
            gl.attachShader(shaderProgram, vShader); // put vertex shader in program
            gl.linkProgram(shaderProgram); // link program into gl context

            if (!gl.getProgramParameter(shaderProgram, gl.LINK_STATUS)) { // bad program link
                throw "error during shader program linking: " + gl.getProgramInfoLog(shaderProgram);
            } else { // no shader program link errors
                gl.useProgram(shaderProgram); // activate shader program (frag and vert)
                vertexPositionAttrib = // get pointer to vertex shader input
                    gl.getAttribLocation(shaderProgram, "vertexPosition"); 

                vertexNormalAttrib = // get pointer to vertex shader input
                    gl.getAttribLocation(shaderProgram, "vertexNormal");

                vertexUVAttrib = // get pointer to vertex shader input
                    gl.getAttribLocation(shaderProgram, "vertexUV");

                modelMatrixULoc = gl.getUniformLocation(shaderProgram, "uModelMatrix"); // ptr to mmat
                viewMatrixULoc = gl.getUniformLocation(shaderProgram, "uViewMatrix"); //ptr to vmat
                perspectiveMatrixULoc = gl.getUniformLocation(shaderProgram, "uPerpectiveMatrix"); //ptr to pmat
                normalMatrixULoc = gl.getUniformLocation(shaderProgram, "uNormalMatrix"); //ptr to nmat

                vertexAmbient = gl.getUniformLocation(shaderProgram, "Ka"); 
                vertexDiffuse = gl.getUniformLocation(shaderProgram, "Kd");
                vertexSpecular = gl.getUniformLocation(shaderProgram, "Ks");
                vertexExp = gl.getUniformLocation(shaderProgram, "n");

                vertexEye = gl.getUniformLocation(shaderProgram, "eyePosition");
                vertexLight = gl.getUniformLocation(shaderProgram, "lightPosition");
                vertexUSampler = gl.getUniformLocation(shaderProgram, "uSampler");
                lightModelULoc = gl.getUniformLocation(shaderProgram, "lightModel");
                uAlphaULoc = gl.getUniformLocation(shaderProgram, "uAlpha");

                //enable the attributes
                gl.enableVertexAttribArray(vertexPositionAttrib); 
                gl.enableVertexAttribArray(vertexNormalAttrib); 
                gl.enableVertexAttribArray(vertexUVAttrib);
            } // end if no shader program link errors
        } // end if no compile errors
    } // end try 
    
    catch(e) {
        console.log(e);
    } // end catch
} // end setup shaders

//Referred sources to implement this function correctly
function myLookAt(viewMat, Eye, lookAtP, up) 
{    
    var z = new vec3.fromValues(0,0,0);
    vec3.normalize(z, new vec3.fromValues(-lookAtP[0] + Eye[0], -lookAtP[1] + Eye[1], -lookAtP[2] + Eye[2]));
    var x = new vec3.fromValues(0,0,0);
    
    vec3.cross(x, z, up);
    vec3.normalize(x,x);
    
    var y = new vec3.fromValues(0,0,0);
    vec3.cross(y, x, z);
    vec3.normalize(y,y);
    
    viewMat[0] = x[0];
    viewMat[4] = x[1];
    viewMat[8] = x[2];
    viewMat[12] = -vec3.dot(x,Eye);
    viewMat[1] = y[0];
    viewMat[5] = y[1];
    viewMat[9] = y[2];
    viewMat[13] = -vec3.dot(y,Eye);
    viewMat[2] = z[0];
    viewMat[6] = z[1];
    viewMat[10] = z[2];
    viewMat[14] = -vec3.dot(z,Eye);
    viewMat[3] = 0;
    viewMat[7] = 0;
    viewMat[11] = 0;
    viewMat[15] = 1;

    return viewMat;
}

//Calculating triangle normals
function Triangle_Normals() {
    for (var whichTriSet=0; whichTriSet<numTriangleSets; whichTriSet++) {
        mat4.invert(inputTriangles[whichTriSet].nMatrix, inputTriangles[whichTriSet].mMatrix);
        mat4.transpose(inputTriangles[whichTriSet].nMatrix, inputTriangles[whichTriSet].nMatrix);
        //console.log(inputTriangles[whichTriSet].nMatrix);
    }
}

//Depth Sorting according to the z-positions
function dsort()
{
    var temp = [], temp1 = [];
    for(whichTriSet=0; whichTriSet<numTriangleSets; whichTriSet++)
    {
        temp[whichTriSet] = Centroid(whichTriSet)[2];
    }
    for(whichTriSet=0; whichTriSet<numTriangleSets; whichTriSet++)
    {
        temp1[whichTriSet] = Centroid(whichTriSet)[2];
    }

    temp1.sort();
    temp1.reverse();

    for(var i=0; i<temp1.length; i++)
    {
        for(var j=0; j<temp.length; j++)
        {
            if(temp1[i] == temp[j])
            {
                sortedTriangleSets[i] = j;
            }
        }
    }
}

function render(whichTriSet)
{
     // pass modeling matrix for set to shader
        gl.uniformMatrix4fv(modelMatrixULoc, false, inputTriangles[whichTriSet].mMatrix);
        gl.uniformMatrix4fv(viewMatrixULoc, false, viewMat);
        gl.uniformMatrix4fv(perspectiveMatrixULoc, false, pMat);
        gl.uniformMatrix4fv(normalMatrixULoc, false, inputTriangles[whichTriSet].nMatrix);

        gl.uniform3fv(vertexEye, Eye);
        gl.uniform3fv(vertexLight, Light);
        gl.uniform1i(vertexUSampler, 0);

        gl.uniform1i(lightModelULoc, lightModel);
        gl.uniform3fv(vertexAmbient, inputTriangles[whichTriSet].Ka);
        gl.uniform3fv(vertexDiffuse, inputTriangles[whichTriSet].Kd);
        gl.uniform3fv(vertexSpecular, inputTriangles[whichTriSet].Ks);
        gl.uniform1f(vertexExp, inputTriangles[whichTriSet].n);
        //gl.uniform1f(uAlphaULoc, inputTriangles[whichTriSet].alpha);

        // vertex buffer: activate and feed into vertex shader
        gl.bindBuffer(gl.ARRAY_BUFFER,vertexBuffers[whichTriSet]); // activate
        gl.vertexAttribPointer(vertexPositionAttrib,3,gl.FLOAT,false,0,0); // feed

        // vertex normal buffer: activate and feed into vertex shader
        gl.bindBuffer(gl.ARRAY_BUFFER,vertexNormalBuffers[whichTriSet]); // activate
        gl.vertexAttribPointer(vertexNormalAttrib,3,gl.FLOAT,false,0,0); // feed

        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, textures[whichTriSet]);
        
        //vertex uvs buffer: activate and feed into vertex shader
        gl.bindBuffer(gl.ARRAY_BUFFER, vertexUVBuffers[whichTriSet]); //activate
        gl.vertexAttribPointer(vertexUVAttrib, 2, gl.FLOAT, false, 0, 0); //feed

        // triangle buffer: activate and render
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, triangleBuffers[whichTriSet]); // activate
        gl.drawElements(gl.TRIANGLES , 3*triSetSizes[whichTriSet],gl.UNSIGNED_SHORT,0); // render
}

function init_npsnake()
{
    npsnake_length=3;
    npsnake_x = [0.6, 0.7, 0.8];
    npsnake_y = [0.6, 0.6, 0.6];
    np_dir =1;
}

function moveNPBody()
{
    for(var i=npsnake_length-1; i>=1; i--)
    {
        npsnake_x[i] = npsnake_x[i-1];
        npsnake_y[i] = npsnake_y[i-1];
    }
}

//Np snake movement
function moveNPSnake () 
{
    moveNPBody();
    //console.log(snake_o_x.length);

    if(c_dir == 5)
    {
        np_dir = Math.floor(Math.random()*(3-0)+0);
        c_dir=0;
    //console.log(np_dir);
    }
    switch(np_dir)
    {
        case 0:
            if(np_dir!=2)
                npsnake_y[0]+=0.1;
            break;
        case 1:
            if(np_dir!=3)
                npsnake_x[0]+=0.1;
            break;
        case 2:
            if(np_dir!=0)
                npsnake_y[0]-=0.1;
            break;
        case 3:
            if(np_dir!=1)
                npsnake_x[0]-=0.1;
            break;
    }

    for(var i=0; i<npsnake_length; i++)
    {
        //loading snake array
        npsnake_vertex = [npsnake_x[i], npsnake_y[i], npsnake_z, 
        npsnake_x[i], npsnake_y[i], npsnake_z+0.1, 
        npsnake_x[i]+0.1, npsnake_y[i], npsnake_z+0.1, 
        npsnake_x[i]+0.1, npsnake_y[i], npsnake_z,
        npsnake_x[i], npsnake_y[i]+0.1, npsnake_z, 
        npsnake_x[i], npsnake_y[i]+0.1, npsnake_z+0.1, 
        npsnake_x[i]+0.1, npsnake_y[i]+0.1, npsnake_z+0.1, 
        npsnake_x[i]+0.1, npsnake_y[i]+0.1, npsnake_z];

        npsnake_indice = [0,1,2,0,2,3,
        0,4,7,0,3,7,
        0,4,5,0,1,5,
        1,5,6,1,2,6,
        2,6,7,2,3,7,
        4,5,6,4,6,7];

        //binding snake buffer
        var npsnakeBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, npsnakeBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(npsnake_vertex), gl.STATIC_DRAW);

        //binding snake indices
        var npindexBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, npindexBuffer);
        gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(npsnake_indice), gl.STATIC_DRAW);
                
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, npsnakeTexture);

        gl.vertexAttribPointer(vertexPositionAttrib,3,gl.FLOAT,false,0,0); 
        gl.drawElements(gl.TRIANGLES, npsnake_indice.length, gl.UNSIGNED_SHORT,0); // render
    }
}
function eat_NP_food()
{
    if(npsnake_x[0].toFixed(1) == food_o_x.toFixed(1) && npsnake_y[0].toFixed(1) == food_o_y.toFixed(1))
    {    
        npsnake_length++;
        food_o_x= Math.random();
        food_o_x= Math.floor(food_o_x*10)/10;
        food_o_y= Math.random();
        food_o_y= Math.floor(food_o_y*10)/10;
    }
}

function death_NP_check()
{
    for(var i=1; i<npsnake_length; i++)
    {
        if((npsnake_x[0]==npsnake_x[i] && npsnake_y[0]==npsnake_y[i]) || (npsnake_x[0]<=0 || npsnake_x[0]>=0.9|| npsnake_y[0]<=0 || npsnake_y[0]>=0.9))
        {
            console.log("Death");
            //cancelAnimationFrame(render_id);
            init_npsnake();
            //alert("Score:"+snake_length);
        }
    }
}

function food()
{
    food_vertex=[];
    //loading food array
    food_vertex.push(food_o_x, food_o_y, food_z);
    food_vertex.push(food_o_x, food_o_y, food_z+0.1);
    food_vertex.push(food_o_x+0.1, food_o_y, food_z+0.1);
    food_vertex.push(food_o_x+0.1, food_o_y, food_z);
    food_vertex.push(food_o_x, food_o_y+0.1, food_z);
    food_vertex.push(food_o_x, food_o_y+0.1, food_z+0.1);
    food_vertex.push(food_o_x+0.1, food_o_y+0.1, food_z+0.1);
    food_vertex.push(food_o_x+0.1, food_o_y+0.1, food_z);

    var food_indice = [0,1,2,0,2,3,
    0,4,7,0,3,7,
    0,4,5,0,1,5,
    1,5,6,1,2,6,
    2,6,7,2,3,7,
    4,5,6,4,6,7]

    //binding snake buffer
    var foodBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, foodBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(food_vertex), gl.STATIC_DRAW);

    //binding snake indices
    var indexBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(food_indice), gl.STATIC_DRAW);
    
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, foodTexture);

    gl.vertexAttribPointer(vertexPositionAttrib,3,gl.FLOAT,false,0,0); 
    gl.drawElements(gl.TRIANGLES , food_indice.length,gl.UNSIGNED_SHORT,0); // render
}

function init_snake()
{
    snake_length=3;
    snake_o_x = [0.3, 0.2, 0.1];
    snake_o_y = [0.1, 0.1, 0.1];
    dir=1;
    //renderTriangles();
}
//to move the body
function moveBody()
{
    for(var i=snake_length-1; i>=1; i--)
    {
        snake_o_x[i] = snake_o_x[i-1];
        snake_o_y[i] = snake_o_y[i-1];
    }
}

//for implementing snake movement
function moveSnake () 
{
    moveBody();
    //console.log(snake_o_x.length);
    switch(dir)
    {
        case 0:
            snake_o_y[0]+=0.1;
            break;
        case 1:
            snake_o_x[0]+=0.1;
            break;
        case 2:
            snake_o_y[0]-=0.1;
            break;
        case 3:
            snake_o_x[0]-=0.1;
            break;
    }

    for(var i=0; i<snake_length; i++)
    {
        //loading snake array
        snake_vertex = [snake_o_x[i], snake_o_y[i], snake_z, 
        snake_o_x[i], snake_o_y[i], snake_z+0.1, 
        snake_o_x[i]+0.1, snake_o_y[i], snake_z+0.1, 
        snake_o_x[i]+0.1, snake_o_y[i], snake_z,
        snake_o_x[i], snake_o_y[i]+0.1, snake_z, 
        snake_o_x[i], snake_o_y[i]+0.1, snake_z+0.1, 
        snake_o_x[i]+0.1, snake_o_y[i]+0.1, snake_z+0.1, 
        snake_o_x[i]+0.1, snake_o_y[i]+0.1, snake_z];

        snake_indice = [0,1,2,0,2,3,
        0,4,7,0,3,7,
        0,4,5,0,1,5,
        1,5,6,1,2,6,
        2,6,7,2,3,7,
        4,5,6,4,6,7];

        //binding snake buffer
        var snakeBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, snakeBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(snake_vertex), gl.STATIC_DRAW);

        //binding snake indices
        var indexBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
        gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(snake_indice), gl.STATIC_DRAW);
                
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, snakeTexture);

        gl.vertexAttribPointer(vertexPositionAttrib,3,gl.FLOAT,false,0,0); 
        gl.drawElements(gl.TRIANGLES, snake_indice.length, gl.UNSIGNED_SHORT,0); // render
    }
}
function eat_food()
{
    if(snake_o_x[0].toFixed(1) == food_o_x.toFixed(1) && snake_o_y[0].toFixed(1) == food_o_y.toFixed(1))
    {    
        snake_length++;
        food_o_x= Math.random();
        food_o_x= Math.floor(food_o_x*10)/10;
        food_o_y= Math.random();
        food_o_y= Math.floor(food_o_y*10)/10;
    }
}
function death_check()
{
    // for(var i=0; i<npsnake_length; i++)
    // {
    //     if(snake_o_x[0] == npsnake_x[i] || snake_o_y[0]==npsnake_y[i])
    //     {
    //         console.log("Death");
    //         cancelAnimationFrame(render_id);
    //         //init_snake();   
    //     }
    // }
    for(var i=1; i<snake_length; i++)
    {
        if((snake_o_x[0]==snake_o_x[i] && snake_o_y[0]==snake_o_y[i]) || (snake_o_x[0]<=0 || snake_o_x[0]>=0.9|| snake_o_y[0]<=0 || snake_o_y[0]>=0.9))
        {
            console.log("Death");
            cancelAnimationFrame(render_id);
            init_snake();
            //alert("Score:"+snake_length);
        }
    }
}
function Game_Control()
{
    food();
    moveSnake();
    eat_food();
    death_check();
}
function Game_Control_NP()
{
    moveNPSnake();
    eat_NP_food();
    death_NP_check();
}

//for fps:
//https://www.kirupa.com/html5/animating_with_requestAnimationFrame.htm
// render the loaded model
function renderTriangles() 
{    
    setTimeout(function ()
    {
    render_id=requestAnimationFrame(renderTriangles);
    
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT); // clear frame/depth buffers    

    var lookAtP = new vec3.fromValues(0,0,0);

    vec3.add(lookAtP, Eye, lookAt);

    viewMat = myLookAt(mat4.create(), Eye, lookAtP, up);
    //console.log(viewMat);

    pMat = mat4.perspective(mat4.create(), Math.PI/2, 1.0, 0.1, 100);

    //transformation according to viewMatrix
    //transform origin
    var t = new vec4.fromValues(origin[0], origin[1], origin[2], 1);
    vec4.transformMat4(t, t, viewMat);
    origin_t[0] = t[0];
    origin_t[1] = t[1];
    origin_t[2] = t[2];

    //transform lookAtP
    var t = new vec4.fromValues(origin_lookAtP[0], origin_lookAtP[1], origin_lookAtP[2], 1);
    vec4.transformMat4(t, t, viewMat);
    origin_tlookAtP[0] = t[0];
    origin_tlookAtP[1] = t[1];
    origin_tlookAtP[2] = t[2];

    //transform up
    var t = new vec4.fromValues(origin_up[0], origin_up[1], origin_up[2], 1);
    vec4.transformMat4(t, t, viewMat);
    origin_tup[0] = t[0] - origin_t[0];
    origin_tup[1] = t[1] - origin_t[1];
    origin_tup[2] = t[2] - origin_t[2];

    Triangle_Normals();

    dsort();

    //for opaque objects
    gl.depthMask(true);
    gl.disable(gl.BLEND);
    gl.enable(gl.DEPTH_TEST);

    for(var whichTriSet=0; whichTriSet<numTriangleSets; whichTriSet++)
    {
        //render opaque
        if(inputTriangles[whichTriSet].alpha == 1.0)
        {
            gl.uniform1f(uAlphaULoc, 1.0);
            render(whichTriSet);
        }
    }

    //for transparent objects
    gl.depthMask(false);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

    for(var i=0; i<sortedTriangleSets.length; i++)
    {
        var whichTriSet = sortedTriangleSets[i];
        //render transparent
        if(inputTriangles[whichTriSet].alpha != 1)
        {
            gl.uniform1f(uAlphaULoc, inputTriangles[whichTriSet].alpha);
            render(whichTriSet);
        }
    }

    c_dir++;
    Game_Control();
    Game_Control_NP();

    }, 1000/fps);
} // end render triangles

/* MAIN -- HERE is where execution begins after window load */
function moveForward()
{
    var z = new vec3.fromValues(0.0,0.0,0.0);
    vec3.copy(z, lookAt);
    vec3.normalize(z,z);
    vec3.scale(z, z, 0.01);
    vec3.add(Eye, Eye, z);
}

function moveBackward()
{
    var z = new vec3.fromValues(0.0, 0.0, 0.0);
    vec3.copy(z, lookAt);
    vec3.normalize(z,z);
    vec3.scale(z, z, -0.01);
    vec3.add(Eye, Eye, z);
}

function moveUp()
{
    var y = new vec3.fromValues(0.0, 0.0, 0.0);
    vec3.copy(y, up);
    vec3.normalize(y,y);
    vec3.scale(y, y, 0.01);
    vec3.add(Eye, Eye, y);
}

function moveDown()
{
    var y = new vec3.fromValues(0.0, 0.0, 0.0);
    vec3.copy(y, up);
    vec3.normalize(y,y);
    vec3.scale(y, y, -0.01);
    vec3.add(Eye, Eye, y);
}

function moveLeft()
{
    var x = new vec3.fromValues(0.0, 0.0, 0.0);
    vec3.cross(x , lookAt, up);
    vec3.normalize(x, x);
    vec3.scale(x, x, 0.01);
    vec3.add(Eye, Eye, x);
}

function moveRight()
{
    var x = new vec3.fromValues(0.0, 0.0, 0.0);
    vec3.cross(x , lookAt, up);
    vec3.normalize(x, x);
    vec3.scale(x, x, -0.01);
    vec3.add(Eye, Eye, x);
}

function yaw_Left()
{
    var lookAtP = new vec3.fromValues(0, 0, 0);
    vec3.add(lookAtP, Eye, lookAt);

    var transformed_lookAt = new vec4.fromValues(0,0,0,1);
    var rotate_lookAt = mat4.create();

    transformed_lookAt[0] = lookAtP[0];
    transformed_lookAt[1] = lookAtP[1];
    transformed_lookAt[2] = lookAtP[2];

    //original view
    var orig_view = myLookAt(mat4.create(), origin_t, origin_tlookAtP, origin_tup);
    
    //Rotate along Y-axis
    mat4.multiply(rotate_lookAt,
                    mat4.fromRotation(mat4.create(), 0.7*Math.PI/180, vec3.fromValues(0,1,0)),
                    rotate_lookAt);

    vec4.transformMat4(transformed_lookAt, transformed_lookAt, viewMat);
    vec4.transformMat4(transformed_lookAt, transformed_lookAt, rotate_lookAt);
    vec4.transformMat4(transformed_lookAt, transformed_lookAt, orig_view);

    //new lookAtP
    lookAtP[0] = transformed_lookAt[0];
    lookAtP[1] = transformed_lookAt[1];
    lookAtP[2] = transformed_lookAt[2];

    //setting the new lookAt
    vec3.subtract(lookAt, lookAtP, Eye);
    vec3.normalize(lookAt, lookAt);
}

function yaw_Right()
{
    var lookAtP = new vec3.fromValues(0, 0, 0);
    vec3.add(lookAtP, Eye, lookAt);

    var transformed_lookAt = new vec4.fromValues(0,0,0,1);
    var rotate_lookAt = mat4.create();

    transformed_lookAt[0] = lookAtP[0];
    transformed_lookAt[1] = lookAtP[1];
    transformed_lookAt[2] = lookAtP[2];

    //original view
    var orig_view = myLookAt(mat4.create(), origin_t, origin_tlookAtP, origin_tup);

    //Rotate along Y-axis
    mat4.multiply(rotate_lookAt,
                    mat4.fromRotation(mat4.create(), -0.7*Math.PI/180, vec3.fromValues(0,1,0)),
                    rotate_lookAt);

    vec4.transformMat4(transformed_lookAt, transformed_lookAt, viewMat);
    vec4.transformMat4(transformed_lookAt, transformed_lookAt, rotate_lookAt);
    vec4.transformMat4(transformed_lookAt, transformed_lookAt, orig_view);

    //new lookAtP
    lookAtP[0] = transformed_lookAt[0];
    lookAtP[1] = transformed_lookAt[1];
    lookAtP[2] = transformed_lookAt[2];

    //setting the new lookAt
    vec3.subtract(lookAt, lookAtP, Eye);
    vec3.normalize(lookAt, lookAt);

}

function pitch_Up()
{   
    var lookAtP =new vec3.fromValues(0,0,0);
    vec3.add(lookAtP, Eye, lookAt);

    var transformed_lookAt = new vec4.fromValues(0,0,0,1);
    var rotate_lookAt = mat4.create();

    transformed_lookAt[0] = lookAtP[0];
    transformed_lookAt[1] = lookAtP[1];
    transformed_lookAt[2] = lookAtP[2];

    //original view
    var orig_view = myLookAt(mat4.create(), origin_t, origin_tlookAtP, origin_tup);

    mat4.multiply(rotate_lookAt,
                    mat4.fromRotation(mat4.create(), -0.7*Math.PI/180, vec3.fromValues(1,0,0)),
                    rotate_lookAt);

    vec4.transformMat4(transformed_lookAt, transformed_lookAt, viewMat);
    vec4.transformMat4(transformed_lookAt, transformed_lookAt, rotate_lookAt);
    vec4.transformMat4(transformed_lookAt, transformed_lookAt, orig_view);

    //new lookAtP
    lookAtP[0] = transformed_lookAt[0];
    lookAtP[1] = transformed_lookAt[1];
    lookAtP[2] = transformed_lookAt[2];

    //setting the new lookAt
    vec3.subtract(lookAt, lookAtP, Eye);
    vec3.normalize(lookAt, lookAt);

    var up_t = new vec3.fromValues(0,0,0);
    vec3.add(up_t, Eye, up);

    var transformed_Up = new vec4.fromValues(0,0,0,1);
    var rotate_up = mat4.create();

    transformed_Up[0] = up_t[0];
    transformed_Up[1] = up_t[1];
    transformed_Up[2] = up_t[2];
    
    //original view
    var orig_view = myLookAt(mat4.create(), origin_t, origin_tlookAtP, origin_tup);

    //rotate along X-axis
    mat4.multiply(rotate_up,
                    mat4.fromRotation(mat4.create(), -0.7*Math.PI/180, vec3.fromValues(1,0,0)),
                    rotate_up);

    vec4.transformMat4(transformed_Up, transformed_Up, viewMat);
    vec4.transformMat4(transformed_Up, transformed_Up, rotate_up);
    vec4.transformMat4(transformed_Up, transformed_Up, orig_view);

    //new Up 
    up_t[0] = transformed_Up[0];
    up_t[1] = transformed_Up[1];
    up_t[2] = transformed_Up[2];

    //setting the new Up
    vec3.subtract(up, up_t, Eye);
    vec3.normalize(up, up);
}

function pitch_Down()
{
    var lookAtP =new vec3.fromValues(0,0,0);
    vec3.add(lookAtP, Eye, lookAt);

    var transformed_lookAt = new vec4.fromValues(0,0,0,1);
    var rotate_lookAt = mat4.create();

    transformed_lookAt[0] = lookAtP[0];
    transformed_lookAt[1] = lookAtP[1];
    transformed_lookAt[2] = lookAtP[2];

    //original view
    var orig_view = myLookAt(mat4.create(), origin_t, origin_tlookAtP, origin_tup);

    mat4.multiply(rotate_lookAt,
                    mat4.fromRotation(mat4.create(), 0.7*Math.PI/180, vec3.fromValues(1,0,0)),
                    rotate_lookAt);

    vec4.transformMat4(transformed_lookAt, transformed_lookAt, viewMat);
    vec4.transformMat4(transformed_lookAt, transformed_lookAt, rotate_lookAt);
    vec4.transformMat4(transformed_lookAt, transformed_lookAt, orig_view);

    //new lookAtP
    lookAtP[0] = transformed_lookAt[0];
    lookAtP[1] = transformed_lookAt[1];
    lookAtP[2] = transformed_lookAt[2];

    //setting the new lookAt
    vec3.subtract(lookAt, lookAtP, Eye);
    vec3.normalize(lookAt, lookAt);

    var up_t = new vec3.fromValues(0,0,0);
    vec3.add(up_t, Eye, up);

    var transformed_Up = new vec4.fromValues(0,0,0,1);
    var rotate_up = mat4.create();

    transformed_Up[0] = up_t[0];
    transformed_Up[1] = up_t[1];
    transformed_Up[2] = up_t[2];
    
    //original view
    var orig_view = myLookAt(mat4.create(), origin_t, origin_tlookAtP, origin_tup);

    //rotate along X-axis
    mat4.multiply(rotate_up,
                    mat4.fromRotation(mat4.create(), 0.7*Math.PI/180, vec3.fromValues(1,0,0)),
                    rotate_up);

    vec4.transformMat4(transformed_Up, transformed_Up, viewMat);
    vec4.transformMat4(transformed_Up, transformed_Up, rotate_up);
    vec4.transformMat4(transformed_Up, transformed_Up, orig_view);

    //new Up 
    up_t[0] = transformed_Up[0];
    up_t[1] = transformed_Up[1];
    up_t[2] = transformed_Up[2];

    //setting the new Up
    vec3.subtract(up, up_t, Eye);
    vec3.normalize(up, up);
}

function Centroid(whichTriSet)
{
    var coordinates = inputTriangles[whichTriSet].coordArray;
    var centroid = vec3.fromValues(0.0, 0.0, 0.0);

    for (var  i = 0; i < coordinates.length/3; i++) 
    {
        centroid[0] = centroid[0] + coordinates[i*3];
        centroid[1] = centroid[1] + coordinates[i*3 + 1];
        centroid[2] = centroid[2] + coordinates[i*3 + 2];
    }

    vec3.scale(centroid, centroid, 1/(coordinates.length/3));

    var t = new vec4.fromValues(0, 0, 0, 1);
    t[0] = centroid[0];
    t[1] = centroid[1];
    t[2] = centroid[2];

    //transform mat4 to vec4
    vec4.transformMat4(t, t, inputTriangles[whichTriSet].mMatrix);
    
    //scaled centroid
    //console.log("transform="+ t);
    
    centroid[0] = t[0];
    centroid[1] = t[1];
    centroid[2] = t[2];

    return centroid;
}

function Highlight(whichTriSet, scaleFactor)
{
    var setCenter = Centroid(whichTriSet);

    mat4.multiply(inputTriangles[whichTriSet].mMatrix, 
                    mat4.fromTranslation(mat4.create(), vec3.negate(vec3.create(), setCenter)),
                    inputTriangles[whichTriSet].mMatrix);

    var scale = vec3.fromValues(scaleFactor, scaleFactor, scaleFactor);

    mat4.multiply(inputTriangles[whichTriSet].mMatrix,
                    mat4.fromScaling(mat4.create(),scale),
                    inputTriangles[whichTriSet].mMatrix);

    mat4.multiply(inputTriangles[whichTriSet].mMatrix,
                    mat4.fromTranslation(mat4.create(),setCenter),
                    inputTriangles[whichTriSet].mMatrix);
    //scaled matrix
    //console.log("scale:"+inputTriangles[whichTriSet].mMatrix);

}

function anti_Highlight()
{
    if (triangleSelection[triangleSelection_index] == 1)
    {
        triangleSelection[triangleSelection_index] = 0;
        Highlight(triangleSelection_index, 1/1.2);   
    }
}

function inc_A()
{   
    if (triangleSelection[triangleSelection_index] == 1)
    {
        inputTriangles[triangleSelection_index].Ka[0] = (inputTriangles[triangleSelection_index].Ka[0] + 0.1)%1;
        inputTriangles[triangleSelection_index].Ka[1] = (inputTriangles[triangleSelection_index].Ka[1] + 0.1)%1;
        inputTriangles[triangleSelection_index].Ka[2] = (inputTriangles[triangleSelection_index].Ka[2] + 0.1)%1;
    }

}

function inc_D()
{
    if (triangleSelection[triangleSelection_index] == 1)
    {
        inputTriangles[triangleSelection_index].Kd[0] = (inputTriangles[triangleSelection_index].Kd[0] + 0.1)%1;
        inputTriangles[triangleSelection_index].Kd[1] = (inputTriangles[triangleSelection_index].Kd[1] + 0.1)%1;
        inputTriangles[triangleSelection_index].Kd[2] = (inputTriangles[triangleSelection_index].Kd[2] + 0.1)%1;
    }
}

function inc_S()
{
    if (triangleSelection[triangleSelection_index] == 1)
    {
        inputTriangles[triangleSelection_index].Ks[0] = (inputTriangles[triangleSelection_index].Ks[0] + 0.1)%1;
        inputTriangles[triangleSelection_index].Ks[1] = (inputTriangles[triangleSelection_index].Ks[1] + 0.1)%1;
        inputTriangles[triangleSelection_index].Ks[2] = (inputTriangles[triangleSelection_index].Ks[2] + 0.1)%1;
    }
}

function inc_exp()
{
    if (triangleSelection[triangleSelection_index] == 1)
    {
        inputTriangles[triangleSelection_index].n = (inputTriangles[triangleSelection_index].n + 1)%20;
       
    }
}


function moveThings(e)
{   
    switch(e.key)
    {
        case 'a': moveLeft();
                    break;
        case 'd': moveRight();
                    break;
        case 'w': moveForward();
                    break;
        case 's': moveBackward();
                    break;
        case 'q': moveUp();
                    break;
        case 'e': moveDown();
                    break;
        case 'A': yaw_Left();  
                    break;
        case 'D': yaw_Right();  
                    break;
        case 'W': pitch_Up();
                    break;
        case 'S': pitch_Down();
                    break;                    
        case 'ArrowLeft': 
                    if(dir!=1)
                        dir=3;
                    break;

        case 'ArrowRight': 
                    if(dir!=3)
                        dir=1;
                    break;

        case 'ArrowUp':
                    if(dir!=2)
                        dir=0;
                    break;

        case 'ArrowDown':
                    if(dir!=0)
                        dir=2;
                    break;
        case 'Enter':
                    renderTriangles();
        case ' ': anti_Highlight();
                    break;

        case 'b': (lightModel == 1)? lightModel=0 : lightModel=1;
                    break;

        case 'n': inc_exp();
                    break;

        case '1': inc_A();
                    break;
        case '2': inc_D();
                    break;
        case '3': inc_S();
                    break;
        default:    break;

    }

}
//Referred "https://developer.mozilla.org/en-US/docs/Web/API/WebGL_API/Tutorial/Using_textures_in_WebGL" for implementing texture mapping
function isPowerOf2(value) {
  return (value & (value - 1)) == 0;
}

function setupTexture() 
{
    //set triangle texture
    for(var whichTriSet = 0; whichTriSet < numTriangleSets; whichTriSet++) 
    {
        textures[whichTriSet] = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, textures[whichTriSet]);

        //snake texture
        snakeTexture = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, snakeTexture);
        
        //food texture
        foodTexture = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, foodTexture);

        //np snake texture
        npsnakeTexture = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, npsnakeTexture);

        var level = 0;
        var internalFormat = gl.RGBA;
        var width = 1;
        var height = 1;
        var border = 0;
        var srcFormat = gl.RGBA;
        var srcType = gl.UNSIGNED_BYTE;
        var pixel = new Uint8Array([0, 0, 255, 255]);  // opaque blue
        gl.texImage2D(gl.TEXTURE_2D, level, internalFormat,
            width, height, border, srcFormat, srcType, pixel);

        textures[whichTriSet].image = new Image();
        textures[whichTriSet].image.crossOrigin = "Anonymous";
        (function (whichTriSet){
            textures[whichTriSet].image.onload = function() {
                gl.bindTexture(gl.TEXTURE_2D, textures[whichTriSet]);
                gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
                gl.texImage2D(gl.TEXTURE_2D, level, internalFormat, srcFormat, srcType, textures[whichTriSet].image);

                if(isPowerOf2(textures[whichTriSet].image.width) && isPowerOf2(textures[whichTriSet].image.height))
                {
                    gl.generateMipmap(gl.TEXTURE_2D);
                }
                else
                {    
                    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
                    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
                    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
                    gl.bindTexture(gl.TEXTURE_2D, null);
                }
            }
         })(whichTriSet);
         textures[whichTriSet].image.src = "http://localhost:8000/" + inputTriangles[whichTriSet].material.texture;

        snakeTexture.image = new Image();
        snakeTexture.image.crossOrigin = "Anonymous";
        (function (snakeTexture){
            snakeTexture.image.onload = function() {
                gl.bindTexture(gl.TEXTURE_2D, snakeTexture);
                gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
                gl.texImage2D(gl.TEXTURE_2D, level, internalFormat, srcFormat, srcType, snakeTexture.image);

                if(isPowerOf2(snakeTexture.image.width) && isPowerOf2(snakeTexture.image.height))
                {
                    gl.generateMipmap(gl.TEXTURE_2D);
                }
                else
                {    
                    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
                    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
                    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
                    gl.bindTexture(gl.TEXTURE_2D, null);
                }
            }
         })(snakeTexture);
         snakeTexture.image.src = "http://localhost:8000/yellow.png";

        foodTexture.image = new Image();
        foodTexture.image.crossOrigin = "Anonymous";
        (function (foodTexture){
            foodTexture.image.onload = function() {
                gl.bindTexture(gl.TEXTURE_2D, foodTexture);
                gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
                gl.texImage2D(gl.TEXTURE_2D, level, internalFormat, srcFormat, srcType, foodTexture.image);

                if(isPowerOf2(foodTexture.image.width) && isPowerOf2(foodTexture.image.height))
                {
                    gl.generateMipmap(gl.TEXTURE_2D);
                }
                else
                {    
                    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
                    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
                    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
                    gl.bindTexture(gl.TEXTURE_2D, null);
                }
            }
         })(foodTexture);
         foodTexture.image.src = "http://localhost:8000/cyan.jpg";

        npsnakeTexture.image = new Image();
        npsnakeTexture.image.crossOrigin = "Anonymous";
        (function (npsnakeTexture){
            npsnakeTexture.image.onload = function() {
                gl.bindTexture(gl.TEXTURE_2D, npsnakeTexture);
                gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
                gl.texImage2D(gl.TEXTURE_2D, level, internalFormat, srcFormat, srcType, npsnakeTexture.image);

                if(isPowerOf2(npsnakeTexture.image.width) && isPowerOf2(npsnakeTexture.image.height))
                {
                    gl.generateMipmap(gl.TEXTURE_2D);
                }
                else
                {    
                    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
                    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
                    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
                    gl.bindTexture(gl.TEXTURE_2D, null);
                }
            }
         })(npsnakeTexture);
         npsnakeTexture.image.src = "http://localhost:8000/np.jpg";
    }
}
//
function main() 
{
    window.addEventListener("keydown", moveThings, false);
    setupWebGL(); // set up the webGL environment
    loadTriangles(); // load in the triangles from tri file
    setupShaders(); // setup the webGL shaders
    setupTexture();
    renderTriangles(); // draw the triangles using webGL
} // end main
