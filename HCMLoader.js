

HCMLoader = function()
{
};


HCMLoader.prototype =
{
	constructor: HCMLoader,

	loadFileFromFile: function (file, callback)
	{
		var tmpThis = this;
		var mesh = new HCMMesh();
		var compartments = new Array();
		var reader = new FileReader();
		reader.onload = (function(theFile) {
			return function(e) {
				var parser = new DOMParser();
				var xmlDoc = parser.parseFromString(e.target.result, "application/xml");
				if (xmlDoc !== null)
				{
					tmpThis.processData(xmlDoc, mesh, compartments);
					xmlDoc = null;
					callback();
				}
			};
		})(file);

		reader.readAsText(file);
		return { mesh: mesh, treeData: compartments };
	},


	loadFileFromPath: function (fileName, callback)
	{
		var mesh = new HCMMesh();
		// Parse the XML file
		var xmlhttp = new XMLHttpRequest();
		xmlhttp.onloadend = function()
		{
			var xmlDoc = this.responseXML;
			if (this.status === 200 && xmlDoc === null)
			{
				var parser = new DOMParser();
				xmlDoc = parser.parseFromString(this.response, "application/xml");
			}
			if (xmlDoc !== null)
			{
				// Success
				this.processData(xmlDoc, mesh, compartments);
				xmlDoc = null;
				callback();
			}
			else
			{
				// something went wrong
			}
		};
		xmlhttp.open("GET", fileName);
		xmlhttp.send();
		var xmlDoc = xmlhttp.responseXML;
		return mesh;
	},

	processData: function(xmlDoc, mesh, compartments)
	{
		// Read plates
		processPlates(mesh);
		// Read stiffeners
		processStiffeners(mesh);
		mesh.finalize();
		// Read compartments
		processCompartments(compartments);

		function processPlates(mesh)
		{
			var plates = xmlDoc.getElementsByTagName("Plate");
			for (var i = 0; i < plates.length; ++i)
			{
				var plate = plates[i];
				var plateId = plate.getAttribute('id');
				var thickness = parseFloat(plate.getAttribute('thickness'));
				var triangleMesh = plate.getElementsByTagName("Mesh");
				if (triangleMesh.length > 0)
				{
					// Read Mesh
					var meshNode = triangleMesh[0];
					var vertices = meshNode.getElementsByTagName("Vertex");
					var triangles = meshNode.getElementsByTagName("Triangle");
					mesh.addPlateFromTriangleMesh(plateId, vertices, triangles, thickness, parseFloat);
				}
				else // No triangle mesh
				{
					// Outer contour
					var outerContour = plate.getElementsByTagName("OuterContour")[0];
					var outerVertices = parseVertices(outerContour.getElementsByTagName("Vertex"));
					var holeContours = plate.getElementsByTagName("InnerContour");
					var holeVertices = new Array();
					for (var j = 0; j < holeContours.length; ++j)
						holeVertices[j] = parseVertices(holeContours[j].getElementsByTagName("Vertex"));

					// 3 or 4 vertices in the contour, no holes
					if (outerVertices.length <= 4 && holeVertices.length == 0)
					{
						mesh.addPlateSimple(plateId, outerVertices);
						continue;
					}
					else // More than 4 vertices in the contour, or has holes
					{
						mesh.addPlateWithTriangulation(plateId, outerVertices, holeVertices);
					}
				} // end if has triangle mesh
			} // end for
		} // end function processPlates()


		function processStiffeners(mesh)
		{
			var stiffeners = xmlDoc.getElementsByTagName("Stiffener");
			for (var i = 0; i < stiffeners.length; ++i)
			{
				var stiffener = stiffeners[i];
				var stiffId = stiffener.getAttribute('id');
				var shape = stiffener.getAttribute('type');
				var orientSide = stiffener.getAttribute('orientation');
				var thickness = parseFloat(stiffener.getAttribute('thickness'));
				var height = parseFloat(stiffener.getAttribute('height'));
				var radiusAttr = stiffener.getAttribute('radius')
				var radius = radiusAttr ? parseFloat(radiusAttr) : 1.0;
				var offset = parseFloat(stiffener.getAttribute('offset'));
				var vertexNodes = stiffener.getElementsByTagName("TraceLine")[0].getElementsByTagName("Vertex");
				var vertices = parseVertices(vertexNodes);
				var orientations = parseOrientations(stiffener);
				var radiuses = parseRadiuses(stiffener);
				var flanges = parseFlanges(stiffener);
				mesh.addStiffener(stiffId, vertices, orientations, radiuses, shape,
								  thickness, height, radius, offset, orientSide, flanges);
			}
		} // end function processStiffeners()


		function parseVertices(vertexNodes)
		{
			var vertices = new Array();
			for (var i = 0; i < vertexNodes.length; ++i)
			{
				var vertex = vertexNodes[i];
				var x = parseFloat(vertex.getAttribute('x'));
				var y = parseFloat(vertex.getAttribute('y'));
				var z = parseFloat(vertex.getAttribute('z'));
				vertices[i] = new THREE.Vector3(x, y, z);
			}
			return vertices;
		}

		function parseOrientations(stiffener)
		{
			var orientNodes = stiffener.getElementsByTagName("Orientations")[0].getElementsByTagName("Direction");
			var orients = new Array();
			for (var i = 0; i < orientNodes.length; ++i)
			{
				var orient = orientNodes[i];
				var x = parseFloat(orient.getAttribute('i'));
				var y = parseFloat(orient.getAttribute('j'));
				var z = parseFloat(orient.getAttribute('k'));
				orients[i] = new THREE.Vector3(x, y, z);
			}
			return orients;
		}

		function parseRadiuses(stiffener)
		{
			var radiusesNode = stiffener.getElementsByTagName("Radiuses");
			if (radiusesNode.length == 0)
				return new Array();
			var radiusNodes = radiusesNode[0].getElementsByTagName("Radius");
			var radiuses = new Array();
			for (var i = 0; i < radiusNodes.length; ++i)
			{
				radiuses[i] = parseFloat(radiusNodes[i].innerHTML);
			}
			return radiuses;
		}

		function parseFlanges(stiffener)
		{
			var flangeNodes = stiffener.getElementsByTagName("Flange");
			var flanges = new Array();
			for (var i = 0; i < flangeNodes.length; ++i)
			{
				var flangeNode = flangeNodes[i];
				flanges[i] = new Object();
				flanges[i].position = flangeNode.getAttribute('position');
				flanges[i].breadth = parseFloat(flangeNode.getAttribute('breadth'));
				flanges[i].thickness = parseFloat(flangeNode.getAttribute('thickness'));
			}
			return flanges;
		}

		function processCompartments()
		{
			var compNodes = xmlDoc.getElementsByTagName("Compartment");
			for (var i = 0; i < compNodes.length; ++i)
			{
				var compNode = compNodes[i];
				compartments[i] = compNode.getAttribute("name");
			}
		}

	}  // end function processData()

}; // end class HCMLoader
