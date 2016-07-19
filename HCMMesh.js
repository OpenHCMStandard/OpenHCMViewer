
var wireframeMaterial = new THREE.MeshBasicMaterial(
	{
		color: 0x000000,
		wireframe: true,
		transparent: true
	});

var plateBasicMaterial = new THREE.MeshBasicMaterial(
	{
		color: 0xbb0000,
		side : THREE.DoubleSide
	});
var plateMaterial =  new THREE.MeshPhongMaterial(
	{
		ambient: 0x550000,
		color: 0xbb0000,
		specular: 0xff5555,
		shininess: 20, // 50,
		shading: THREE.FlatShading, //THREE.SmoothShading,
		side: THREE.DoubleSide
	});

var stiffenerBasicMaterial = new THREE.MeshBasicMaterial(
	{
		color: 0xbbbb00,
		side: THREE.DoubleSide
	});
var stiffenerMaterial = new THREE.MeshPhongMaterial(
	{
		ambient: 0x555500,
		color: 0xbbbb00,
		specular: 0xffff55,
		shininess: 20, // 50,
		shading: THREE.FlatShading, //THREE.SmoothShading,
		side: THREE.DoubleSide
	});



HCMMesh = function()
{
	this.plateVertexCount = 0;
	this.stiffenerVertexCount = 0;
	this.plateGeometry = new THREE.Geometry();
	this.stiffenerGeometry = new THREE.Geometry();

	this.showMesh = false;
	this.hasLighting = true;

	this.plates = new Object();
	this.stiffeners = new Object();
};


HCMMesh.prototype =
{
	constructor: HCMMesh,

	// Number of vertices in plates
	plateVertexCount: 0,

	// Number of vertices in stiffeners
	stiffenerVertexCount: 0,

	// Plates in the mesh
	plates: new Object(),

	// Stiffeners in the mesh
	stiffeners: new Object(),

	// Should the material be shaded ?
	hasLighting: true,

	// Should we show the triangulated mesh ?
	showMesh: false,

	// Geometry for all plates
	plateGeometry: new THREE.Geometry(),

	// Geometry for all stiffeners
	stiffenerGeometry: new THREE.Geometry(),

	getPlateMesh: function()
	{
		var mainMaterial = this.hasLighting ? plateMaterial : plateBasicMaterial;
		return this.showMesh ?
			THREE.SceneUtils.createMultiMaterialObject(
				this.plateGeometry,
				[
					mainMaterial,
					wireframeMaterial
				]) :
			new THREE.Mesh(this.plateGeometry, mainMaterial);
	},

	getStiffenerMesh: function()
	{
		var mainMaterial = this.hasLighting ? stiffenerMaterial : stiffenerBasicMaterial;
		return this.showMesh ?
			THREE.SceneUtils.createMultiMaterialObject(
				this.stiffenerGeometry,
				[
					mainMaterial,
					wireframeMaterial
				]) :
			new THREE.Mesh(this.stiffenerGeometry, mainMaterial);
	},

	chooseGeometry: function(onStiffener)
	{
		return onStiffener ? this.stiffenerGeometry : this.plateGeometry;
	},

	// Case where the shape of the plate is described by a triangle mesh
	addPlateSimple: function(id, vertices)
	{
		for (var j = 0; j < vertices.length; ++j)
		{
			this.addVertexFromVector(vertices[j], false);
		}
		if (vertices.length == 3)
		{
			this.addTriangle(this.plateVertexCount, this.plateVertexCount + 1,
							 this.plateVertexCount + 2);
		}
		else if (vertices.length == 4)
		{
			this.addQuad(this.plateVertexCount, this.plateVertexCount + 1,
						 this.plateVertexCount + 2, this.plateVertexCount + 3);
		}
		this.plateVertexCount += vertices.length;
	},

	// Case where the shape of the plate is described by a triangle mesh
	addPlateFromTriangleMesh: function(id, vertices, triangles, thickness, parseFloat)
	{
		var idToIndex = {};
		for (var j = 0; j < vertices.length; j++)
		{
			var vertex = vertices[j];
			var id = vertex.getAttribute('id');
			var x = parseFloat(vertex.getAttribute('x'));
			var y = parseFloat(vertex.getAttribute('y'));
			var z = parseFloat(vertex.getAttribute('z'));
			this.addVertex(x, y, z);
			idToIndex[id] = this.plateVertexCount++;
		}
		for (var j = 0; j < triangles.length; j++)
		{
			var triangle = triangles[j];
			var v1 = triangle.getAttribute('vertex1');
			var v2 = triangle.getAttribute('vertex2');
			var v3 = triangle.getAttribute('vertex3');
			this.addTriangle(idToIndex[v1], idToIndex[v2], idToIndex[v3]);
		}
	},

	addPlateWithTriangulation: function(id, outerVertices, holeVertices)
	{
		var normal = contourNormal(outerVertices);
		// 0 = x, 1 = y, 2 = z
		var maxCoordIndex = function maxCoordinate()
		{
			if (Math.abs(normal.x) >= Math.abs(normal.y))
				return Math.abs(normal.x) >= Math.abs(normal.z) ? 0 : 2;
			else
				return Math.abs(normal.y) >= Math.abs(normal.z) ? 1 : 2;
		}();
		var maxCoord = outerVertices[0].getComponent(maxCoordIndex);
		var axisAligned = function isOne(value)
		{
			return Math.abs(value) + 0.00001 > 1.0;
		}(normal.getComponent(maxCoordIndex));

		var contours2d = projectContours(outerVertices, holeVertices, maxCoordIndex);
		// Use earcut.js to do triangulation
		var triangles = earcut(contours2d, true);

		var contourPlane = new THREE.Plane(normal, outerVertices[0]);
		var remapped;
		// When the contour is not axis-aligned, we need to find a correspondence in the original points
		if (!axisAligned)
		{
			remapped = remapToPoints(triangles.vertices, outerVertices, holeVertices, maxCoordIndex);
			for (var j = 0; j < remapped.length; ++j)
			{
				this.addVertexFromVector(remapped[j], false);
			}
		}
		else // Axis-aligned, just put the correct coordinate back where it belongs
		{
			for (var j = 0; j < triangles.vertices.length; j += 2)
			{
				var vertex = [ triangles.vertices[j], triangles.vertices[j + 1] ];
				var point;
				switch (maxCoordIndex)
				{
				// X axis aligned
				case 0:
					point = new THREE.Vector3(maxCoord, vertex[0], vertex[1]);
					break;
				// Y axis aligned
				case 1:
					point = new THREE.Vector3(vertex[0], maxCoord, vertex[1]);
					break;
				// Z axis aligned
				case 2:
					point = new THREE.Vector3(vertex[0], vertex[1], maxCoord);
					break;
				}

				this.addVertexFromVector(point, false);
			}
		}
		// Create the triangles
		for (var j = 0; j < triangles.indices.length; j += 3)
		{
			this.addTriangle(this.plateVertexCount + triangles.indices[j],
							 this.plateVertexCount + triangles.indices[j + 1],
							 this.plateVertexCount + triangles.indices[j + 2]);
		}

		this.plateVertexCount += (triangles.vertices.length / 2);


		// Search along which axis it would be best to project on a plane
		function contourNormal(vertices)
		{
			if (vertices.length < 3)
				return new THREE.Vector3();

			var normal = new THREE.Vector3();
			for (var i = 2; i < vertices.length; ++i)
			{
				var v1 = vertices[i - 2];
				var v2 = vertices[i - 1];
				var v3 = vertices[i];
				var vec1 = new THREE.Vector3().copy(v2).sub(v1);
				var vec2 = new THREE.Vector3().copy(v3).sub(v1);
				normal.add(vec1.cross(vec2));
			}
			normal.normalize();
			return normal;
		}

		// Calculate the 2D vertices for polygon triangulation
		function projectContours(outerVertices, holeVertexList, coordinateIndex)
		{
			var contours2d = new Array();
			// Outer contour
			contours2d[0] = projectContour(outerVertices, coordinateIndex);
			// Inner contours
			for (var i = 0; i < holeVertexList.length; ++i)
			{
				contours2d[i + 1] = projectContour(holeVertexList[i], coordinateIndex);
			}
			return contours2d;


			function projectContour(contourVertices, coordinateIndex)
			{
				var vertices2d = new Array();
				// Project all the points
				for (var i = 0; i < contourVertices.length; ++i)
				{
					var point = contourVertices[i];
					switch (coordinateIndex)
					{
						case 0:
							vertices2d[i] = [ point.y, point.z ];
							break;
						case 1:
							vertices2d[i] = [ point.x, point.z ];
							break;
						case 2:
							vertices2d[i] = [ point.x, point.y ];
							break;
					}
				}
				return vertices2d;
			}
		}

		function remapToPoints(contour2d, outerContour, holeContours, missingCoordIndex)
		{
			var remappedContour = new Array();
			var coordIndices;
			switch (missingCoordIndex)
			{
			case 0:
				coordIndices = [ 1, 2 ];
				break;
			case 1:
				coordIndices = [ 0, 2 ];
				break;
			case 2:
				coordIndices = [ 0, 1 ];
				break;
			}

			for (var i = 0; i < contour2d.length; i += 2)
			{
				var point2d = new THREE.Vector2(contour2d[i], contour2d[i + 1]);
				var point3d = find2dPointInContour(point2d, outerContour, coordIndices);
				if (point3d)
				{
					remappedContour[i / 2] = point3d;
					continue;
				}
				for (var j = 0; j < holeContours.length; ++j)
				{
					point3d = find2dPointInContour(point2d, holeContours[j], coordIndices);
					if (point3d)
					{
						remappedContour[i / 2] = point3d;
						break;
					}
				}
			}
			return remappedContour;


			function find2dPointInContour(point2d, contour3d, coordIndices)
			{
				for (var i = 0; i < contour3d.length; ++i)
				{
					var point3d = contour3d[i];
					if (point3d.getComponent(coordIndices[0]) === point2d.getComponent(0)
					   && point3d.getComponent(coordIndices[1]) === point2d.getComponent(1))
						return point3d;
				}
				return undefined;
			}
		}

	},

	addStiffener: function(stiffId, vertices, orientations, radiuses, shape,
		thickness, height, radius, offset, orientSide, flanges)
	{
		var profiles = new Array();
		var direction = new THREE.Vector3();
		// For each point in the traceline
		for (var j = 0; j < vertices.length; ++j)
		{
			var vertex = vertices[j];
			var localRadius = (j < radiuses.length) ? radiuses[j] : undefined;
			if (j + 1 < vertices.length)
				direction.copy(vertices[j + 1]).sub(vertex);
			// We need to calculate the profile for each point in the traceline
			// because orientation and radius may vary
			profiles[j] = stiffenerProfile(shape, vertex, direction, orientations[j],
				thickness, height, radius, localRadius, offset, orientSide, flanges);

			if (j > 0)
			{
				// Now loop on vertices in the profile and extrude quads along it
				for (var k = 0; k < profiles[j].length; ++k)
				{
					var p1 = profiles[j - 1][k];
					var p2 = profiles[j][k];
					var p3 = profiles[j][(k + 1) % profiles[j].length];
					var p4 = profiles[j - 1][(k + 1) % profiles[j].length];

					this.addVertexFromVector(p1, true);
					this.addVertexFromVector(p2, true);
					this.addVertexFromVector(p3, true);
					this.addVertexFromVector(p4, true);
					this.addQuad(this.stiffenerVertexCount, this.stiffenerVertexCount + 1,
						this.stiffenerVertexCount + 2, this.stiffenerVertexCount + 3, true);
					this.stiffenerVertexCount += 4;
				}
			}
		}

		function stiffenerProfile(shape, origin, direction, normal,
			thickness, height, radius, pointRadius, offset, orientSide, flanges)
		{
			var profileVertices = new Array();
			normal.normalize();
			var correctOrient = (orientSide == "left");
			var orientVector = correctOrient
				? new THREE.Vector3().copy(normal).cross(direction)
				: new THREE.Vector3().copy(direction).cross(normal);
			orientVector.normalize();
			switch (shape)
			{
			case "FB":
				if (offset && offset !== 0.0)
				{
					var offsetVec = new THREE.Vector3().copy(normal).multiplyScalar(offset);
					origin.add(offsetVec);
				}
				var heightVec = new THREE.Vector3().copy(normal).multiplyScalar(height);
				// The top point is opposite of the origin on the profile
				var topPoint = new THREE.Vector3().copy(origin).add(heightVec);

				// Offset the stiffener just a little to avoid Z-fighting with the supporting plate
				var webOffset = new THREE.Vector3().copy(normal).normalize().multiplyScalar(0.005);

				// Do 2 points on one side
				var displace = new THREE.Vector3().copy(orientVector).multiplyScalar(thickness / 2);
				profileVertices[0] = new THREE.Vector3().copy(origin).add(displace).add(webOffset);
				profileVertices[1] = new THREE.Vector3().copy(topPoint).add(displace).add(webOffset);
				// Do 2 points on the other side
				displace.negate();
				profileVertices[3] = new THREE.Vector3().copy(origin).add(displace);
				profileVertices[2] = new THREE.Vector3().copy(topPoint).add(displace);
				break;
			case "L":
			case "HP":
				if (offset && offset !== 0.0)
				{
					var offsetVec = new THREE.Vector3().copy(normal).multiplyScalar(offset);
					origin.add(offsetVec);
				}

				// Make sure we have a thickness value for flange, otherwise use web thickness
				var flangeThickness = thickness;
				if (flanges.length > 0 && flanges[0].thickness)
					flangeThickness = flanges[0].thickness;
				// Do the same for flange breadth, take web height as default
				var flangeBreadth = height;
				if (flanges.length > 0 && flanges[0].breadth)
					flangeBreadth = flanges[0].breadth;

				// Offset the stiffener just a little to avoid Z-fighting with the supporting plate
				var webOffset = new THREE.Vector3().copy(normal).normalize().multiplyScalar(0.005);

				// Do first point at the bottom of the web
				var displace = new THREE.Vector3().copy(orientVector).multiplyScalar(thickness / 2);
				profileVertices[correctOrient ? 0 : 1] = new THREE.Vector3().copy(origin).add(displace).add(webOffset);
				// Do second point at the bottom of the web
				displace.negate();
				profileVertices[correctOrient ? 1 : 0] = new THREE.Vector3().copy(origin).add(displace).add(webOffset);
				// Do the point at the stiffener external corner
				displace = displace.copy(normal).multiplyScalar(height + flangeThickness / 2);
				profileVertices[correctOrient ? 2 : 5] = new THREE.Vector3().copy(profileVertices[correctOrient ? 1 : 0]).add(displace);
				// Do the first point at flange extremity
				displace = displace.copy(orientVector).multiplyScalar(flangeBreadth);
				profileVertices[correctOrient ? 3 : 4] = new THREE.Vector3().copy(profileVertices[correctOrient ? 2 : 5]).add(displace);
				// Do the second point at flange extremity
				displace = displace.copy(normal).multiplyScalar(-flangeThickness);
				profileVertices[correctOrient ? 4 : 3] = new THREE.Vector3().copy(profileVertices[correctOrient ? 3 : 4]).add(displace);
				// Do the point at the stiffener internal corner
				displace = displace.copy(normal).multiplyScalar(height - flangeThickness / 2);
				profileVertices[correctOrient ? 5 : 2] = new THREE.Vector3().copy(profileVertices[correctOrient ? 0 : 1]).add(displace);
				break;
			case "T":
				if (!correctOrient)
					orientVector.negate();
				if (offset && offset !== 0.0)
				{
					var offsetVec = new THREE.Vector3().copy(normal).multiplyScalar(offset);
					origin.add(offsetVec);
				}

				// Make sure we have a thickness value for flange, otherwise use web thickness
				var flangeThickness = thickness;
				if (flanges.length > 0 && flanges[0].thickness)
					flangeThickness = flanges[0].thickness;
				// Do the same for flange breadth, take web height as default
				var flangeBreadth = height;
				if (flanges.length > 0 && flanges[0].breadth)
					flangeBreadth = flanges[0].breadth;

				// Offset the stiffener just a little to avoid Z-fighting with the supporting plate
				var webOffset = new THREE.Vector3().copy(normal).normalize().multiplyScalar(0.005);

				// Do first point at the bottom of the web
				var displace = new THREE.Vector3().copy(orientVector).multiplyScalar(thickness / 2);
				profileVertices[0] = new THREE.Vector3().copy(origin).add(displace).add(webOffset);
				// Do second point at the bottom of the web
				displace.negate();
				profileVertices[1] = new THREE.Vector3().copy(origin).add(displace).add(webOffset);
				// Do points at internal corners
				displace = displace.copy(normal).multiplyScalar(height - (flangeThickness / 2));
				profileVertices[7] = new THREE.Vector3().copy(profileVertices[0]).add(displace);
				profileVertices[2] = new THREE.Vector3().copy(profileVertices[1]).add(displace);
				// Do points at lower extremity of flange
				displace = displace.copy(orientVector).multiplyScalar((flangeBreadth - thickness) / 2);
				profileVertices[6] = new THREE.Vector3().copy(profileVertices[7]).add(displace);
				displace.negate();
				profileVertices[3] = new THREE.Vector3().copy(profileVertices[2]).add(displace);
				// Do points at upper flange extremity
				displace = displace.copy(normal).multiplyScalar(flangeThickness);
				profileVertices[4] = new THREE.Vector3().copy(profileVertices[3]).add(displace);
				profileVertices[5] = new THREE.Vector3().copy(profileVertices[6]).add(displace);
				break;
			case "O":
				var actualRadius = pointRadius ? pointRadius : radius;
				// Make 4 points in a cross pattern
				var displace = new THREE.Vector3().copy(normal).multiplyScalar(actualRadius);
				profileVertices[0] = new THREE.Vector3().copy(origin).add(displace);
				displace.negate();
				profileVertices[4] = new THREE.Vector3().copy(origin).add(displace);
				displace = new THREE.Vector3().copy(orientVector).multiplyScalar(actualRadius);
				profileVertices[6] = new THREE.Vector3().copy(origin).add(displace);
				displace.negate();
				profileVertices[2] = new THREE.Vector3().copy(origin).add(displace);
				// Now take a 45 degree angle and do 4 more points
				displace = new THREE.Vector3().copy(normal).add(orientVector).normalize().multiplyScalar(actualRadius);
				profileVertices[7] = new THREE.Vector3().copy(origin).add(displace);
				displace.negate();
				profileVertices[3] = new THREE.Vector3().copy(origin).add(displace);
				displace = new THREE.Vector3().copy(normal).sub(orientVector).normalize().multiplyScalar(actualRadius);
				profileVertices[1] = new THREE.Vector3().copy(origin).add(displace);
				displace.negate();
				profileVertices[5] = new THREE.Vector3().copy(origin).add(displace);
				break;
			case "H":
			case "C":
				break;
			default:
				break;
			}
			return profileVertices;
		}

	},

	addVertex: function(x, y, z, onStiffener)
	{
		this.chooseGeometry(onStiffener).vertices.push(new THREE.Vector3(x, y, z));
	},

	addVertexFromVector: function(vec, onStiffener)
	{
		this.chooseGeometry(onStiffener).vertices.push(vec);
	},

	addTriangle: function(v1, v2, v3, onStiffener)
	{
		this.chooseGeometry(onStiffener).faces.push(new THREE.Face3(v1, v2, v3));
	},

	addQuad: function(v1, v2, v3, v4, onStiffener)
	{
		this.chooseGeometry(onStiffener).faces.push(new THREE.Face3(v1, v2, v3));
		this.chooseGeometry(onStiffener).faces.push(new THREE.Face3(v1, v3, v4));
	},

	addFace: function(face, onStiffener)
	{
		this.chooseGeometry(onStiffener).faces.push(face);
	},

	finalize: function()
	{
		finalizeGeometry(this.plateGeometry);
		finalizeGeometry(this.stiffenerGeometry);

		function finalizeGeometry(geometry)
		{
			if (geometry.vertices.length > 0)
			{
				geometry.mergeVertices();
				geometry.computeFaceNormals();
				geometry.computeVertexNormals();
				geometry.computeBoundingBox();
			}
		}
	}

}; // end class MeshBuilder
