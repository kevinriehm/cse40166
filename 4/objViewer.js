var gl;

var u_MvpMatrix;
var u_NormalMatrix;
var u_Texture;
var u_LightPosition;
var u_LightAmbient;
var u_LightDiffuse;
var u_LightSpecular;

var a_Position;
var a_TexCoord;
var a_Normal;
var a_Color;

var texFileName = "";

window.onload = function init()
{
    canvas = document.getElementById( "gl-canvas" );
    
    gl = WebGLUtils.setupWebGL( canvas );
    if ( !gl ) { alert( "WebGL isn't available" ); }
    
    //
    //  Configure WebGL
    //
    gl.viewport( 0, 0, canvas.width, canvas.height );
    gl.clearColor(0.8, 0.8, 0.8, 1.0);
    gl.enable(gl.DEPTH_TEST);

    
    //  Load shaders and initialize attribute buffers
    
    var program = initShaders( gl, "vertex-shader", "fragment-shader" );
    gl.useProgram( program );

    u_MvpMatrix = gl.getUniformLocation(program, "u_MvpMatrix");
    u_NormalMatrix = gl.getUniformLocation(program, "u_NormalMatrix");

    u_Texture = gl.getUniformLocation(program, "u_Texture");

    u_LightPosition = gl.getUniformLocation(program, "u_LightPosition");
    u_LightAmbient = gl.getUniformLocation(program, "u_LightAmbient");
    u_LightDiffuse = gl.getUniformLocation(program, "u_LightDiffuse");
    u_LightSpecular = gl.getUniformLocation(program, "u_LightSpecular");

    a_Position = gl.getAttribLocation(program, "a_Position");
    a_TexCoord = gl.getAttribLocation(program, "a_TexCoord");
    a_Normal = gl.getAttribLocation(program, "a_Normal");
    a_Color = gl.getAttribLocation(program, "a_Color");
    
    if (a_Position < 0 ||  a_Normal < 0 || a_Color < 0 ||
        !u_MvpMatrix || !u_NormalMatrix) {
        console.log('Failed to get the location of attribute, uniform variables');
        return;
    }
    
    // Prepare empty buffer objects for vertex coordinates, colors, and normals
    var model = initVertexBuffers(gl);
    if (!model) {
        console.log('Failed to set the vertex information');
        return;
    }
    
    // calculate view projection matrix
    var viewProjMatrix = mult(perspective(30.0, canvas.width/canvas.height, 1.0, 5000.0),
                              lookAt(vec3(0.0, 400.0, 200.0),
                                     vec3(0.0, 0.0, 0.0),
                                     vec3(0.0, 1.0, 0.0)));
    
    // Start reading the OBJ file
    //readOBJFile('cube.obj', gl, model, 60, true);
    readOBJFile('kia.obj', gl, model, 15, true);
    
    var currentAngle = 0.0; // Current rotation angle [degree]
    var tick = function() {   // Start drawing
        currentAngle = animate(currentAngle); // Update current rotation angle
        draw(gl, currentAngle, viewProjMatrix, model);
        requestAnimationFrame(tick, canvas);
    };
    tick();
    
};

// Create an buffer object and perform an initial configuration
function initVertexBuffers(gl) {
    var o = new Object(); // Utilize Object object to return multiple buffer objects
    o.vertexBuffer = createEmptyArrayBuffer(gl, a_Position, 3, gl.FLOAT);
    o.texCoordBuffer = createEmptyArrayBuffer(gl, a_TexCoord, 2, gl.FLOAT);
    o.normalBuffer = createEmptyArrayBuffer(gl, a_Normal, 3, gl.FLOAT);
    o.colorBuffer = createEmptyArrayBuffer(gl, a_Color, 4, gl.FLOAT);
    o.indexBuffer = gl.createBuffer();
    o.texture = gl.createTexture();
    if (!o.vertexBuffer
        || !o.texCoordBuffer
        || !o.normalBuffer
        || !o.colorBuffer
        || !o.indexBuffer
        || !o.texture) {
        return null;
    }

    gl.bindTexture(gl.TEXTURE_2D, o.texture);    
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);

    gl.bindBuffer(gl.ARRAY_BUFFER, null);
    
    return o;
}

// Create a buffer object, assign it to attribute variables, and enable the assignment
function createEmptyArrayBuffer(gl, a_attribute, num, type) {
    var buffer =  gl.createBuffer();  // Create a buffer object
    if (!buffer) {
        console.log('Failed to create the buffer object');
        return null;
    }
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.vertexAttribPointer(a_attribute, num, type, false, 0, 0);  // Assign the buffer object to the attribute variable
    gl.enableVertexAttribArray(a_attribute);  // Enable the assignment
    
    return buffer;
}

// Read a file
function readOBJFile(fileName, gl, model, scale, reverse) {
    var request = new XMLHttpRequest();
    
    request.onreadystatechange = function() {
        if (request.readyState === 4 && request.status !== 404) {
            onReadOBJFile(request.responseText, fileName, gl, model, scale, reverse);
        }
    }
    request.open('GET', fileName, true); // Create a request to acquire the file
    request.send();                      // Send the request
}

var g_objDoc = null;      // The information of OBJ file
var g_drawingInfo = null; // The information for drawing 3D model

// OBJ File has been read
function onReadOBJFile(fileString, fileName, gl, o, scale, reverse) {
    var objDoc = new OBJDoc(fileName);  // Create a OBJDoc object
    var result = objDoc.parse(fileString, scale, reverse); // Parse the file
    if (!result) {
        g_objDoc = null; g_drawingInfo = null;
        console.log("OBJ file parsing error.");
        return;
    }
    g_objDoc = objDoc;
}

// Coordinate transformation matrix
var g_modelMatrix = mat4();
var g_mvpMatrix = mat4();
var g_normalMatrix = mat3();

// Drawing function
function draw(gl, angle, viewProjMatrix, model) {
    if (g_objDoc != null && g_objDoc.isMTLComplete()){ // OBJ and all MTLs are available
        g_drawingInfo = onReadComplete(gl, model, g_objDoc);
        g_objDoc = null;
    }
    if (!g_drawingInfo) return;
    
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);  // Clear color and depth buffers
    
    g_modelMatrix = mult(rotateX(angle), mult(rotateY(angle), rotateZ(angle)));
    
    
    // Calculate the normal transformation matrix and pass it to u_NormalMatrix
    g_normalMatrix = normalMatrix(g_modelMatrix, true); // return 3 by 3 normal matrix
    
    gl.uniformMatrix3fv(u_NormalMatrix, false, flatten(g_normalMatrix));
    
    // Calculate the model view project matrix and pass it to u_MvpMatrix
    g_mvpMatrix = mult(viewProjMatrix, g_modelMatrix);
    
    gl.uniformMatrix4fv(u_MvpMatrix, false, flatten(g_mvpMatrix));

    // Bind the texture and set its corresponding uniform
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, model.texture);

    gl.uniform1i(u_Texture, 0);

    // Set the light's uniforms
    gl.uniform3f(u_LightPosition, 0, 200, 0);
    gl.uniform3f(u_LightAmbient, 1e5, 1e5, 1e5);
    gl.uniform3f(u_LightDiffuse, 7e5, 7e5, 7e5);
    gl.uniform3f(u_LightSpecular, 1e6, 1e6, 1e6);
    
    // Draw
    gl.drawElements(gl.TRIANGLES, g_drawingInfo.indices.length, gl.UNSIGNED_SHORT, 0);
}

// OBJ File has been read completely
function onReadComplete(gl, model, objDoc) {
    // Acquire the vertex coordinates and colors from OBJ file
    var drawingInfo = objDoc.getDrawingInfo();
    
    // Write date into the buffer object
    gl.bindBuffer(gl.ARRAY_BUFFER, model.vertexBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, drawingInfo.vertices, gl.STATIC_DRAW);
    
    gl.bindBuffer(gl.ARRAY_BUFFER, model.normalBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, drawingInfo.normals, gl.STATIC_DRAW);
    
    gl.bindBuffer(gl.ARRAY_BUFFER, model.colorBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, drawingInfo.colors, gl.STATIC_DRAW);
    
    gl.bindBuffer(gl.ARRAY_BUFFER, model.texCoordBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, drawingInfo.texCoords, gl.STATIC_DRAW);
    
    // Write the indices to the buffer object
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, model.indexBuffer);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, drawingInfo.indices, gl.STATIC_DRAW);

    // Load the texture image file
    var texImg = new Image();
    texImg.onload = function() {
        gl.bindTexture(gl.TEXTURE_2D, model.texture);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, texImg);
        gl.generateMipmap(gl.TEXTURE_2D);

        gl.bindTexture(gl.TEXTURE_2D, null);
    };
    texImg.src = texFileName;
    
    return drawingInfo;
}

var ANGLE_STEP = 10;   // The increments of rotation angle (degrees)

var last = Date.now(); // Last time that this function was called
function animate(angle) {
    var now = Date.now();   // Calculate the elapsed time
    var elapsed = now - last;
    last = now;
    // Update the current rotation angle (adjusted by the elapsed time)
    var newAngle = angle + (ANGLE_STEP * elapsed) / 1000.0;
    return newAngle % 360;
}
