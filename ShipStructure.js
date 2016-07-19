

Plate = function(id, name, compId, memberId, thickness, meshIndex, meshVertexCount)
{
	this.id = id;
	this.name = name;
	this.thickness = thickness;
	this.compId = compId;
	this.memberId = memberId;
	this._startIndex = meshIndex;
	this._vertexCount = meshVertexCount;
};

Plate.prototype =
{
	constructor: Plate,

	id: "",

	name: "",

	thickness: 1,

	compId: "",

	memberId: "",

	_startIndex: 0,

	_vertexCount: 4,

	startIndex: function()
	{
		return _startIndex;
	},

	vertexCount: function()
	{
		return _vertexCount;
	}
};



Stiffener = function(id, name, compId, memberId, webThickness, flangeThickness,
					 webMeshIndex, webMeshVertexCount, flangeMeshIndex, flangeMeshVertexCount)
{
	this.id = id;
	this.name = name;
	this.thickness = thickness;
	this.compId = compId;
	this.memberId = memberId;
	this._webStartIndex = webMeshIndex;
	this._webVertexCount = webMeshVertexCount;
	this._flangeStartIndex = flangeMeshIndex;
	this._flangeVertexCount = flangeMeshVertexCount;
};

Stiffener.prototype =
{
	constructor: Stiffener,

	id: "",

	name: "",

	compId: "",

	memberId: "",

	webThickness: 1,

	flangeThickness: 1,

	webStartIndex: 0,

	webVertexCount: 0,

	flangeStartIndex: 0,

	flangeVertexCount: 0,

	startIndex: function()
	{
		return webStartIndex;
	},

	vertexCount: function()
	{
		return webVertexCount + flangeVertexCount;
	}
};



ShipStructure = function()
{
};

ShipStructure.prototype =
{
	constructor: ShipStructure,

	mesh: new HCMMesh(),

	plates: new Object(),

	stiffeners: new Object(),

	compartments: new Object()
};
