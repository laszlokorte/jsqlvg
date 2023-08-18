function createShape(db) {
	return db.exec(`INSERT INTO shape DEFAULT VALUES RETURNING ID`)[0].values[0][0];
}

function createAnchor(db, shapeId, relX = 0.5, relY = 0.5) {
	const stmt = db.exec(`INSERT INTO 
		shape_anchor (shape_id, relative_x, relative_y) 
		VALUES (:shape_id, :relative_x, :relative_y) RETURNING ID`, 
	{
		':shape_id': shapeId,
		':relative_x': relX,
		':relative_y': relY,
	});


	return stmt[0].values[0][0];
}


function createNode(db, x,y, shapeId) {
	const elementId = db.exec(`INSERT INTO element DEFAULT VALUES RETURNING ID`)[0].values[0][0];
	const stmt = db.exec(`INSERT INTO node
	(element_id, shape_id, position_x, position_y) VALUES 
	(:element_id, :shape_id, :position_x, :position_y)
	 RETURNING ID`, {
		':element_id': elementId,
		':shape_id': shapeId,
		':position_x': x,
		':position_y': y,
	});

	return [stmt[0].values[0][0], elementId];
}

function clearElements(db) {
	db.exec(`DELETE FROM element`);
}

function deleteSelected(db) {
	db.exec(`DELETE FROM element WHERE id IN (SELECT element_id FROM ui_selection WHERE ui_viewport_id = 1)`);
}

function createEdge(db, sourceNode, sourceAnchor, targetNode, targetAnchor, elementId = null) {
	db.exec('BEGIN TRANSACTION');
	elementId = elementId != null ? elementId : db.exec(`INSERT INTO element DEFAULT VALUES RETURNING ID`)[0].values[0][0];
	const stmt = db.exec(`INSERT INTO edge
	(element_id, 
		source_node_id,
		source_shape_id,
		source_anchor_id,
		target_node_id,
		target_shape_id,
		target_anchor_id) 
			SELECT 
			:element_id, source_node.id, source_anchor.shape_id, source_anchor.id,
			target_node.id, target_anchor.shape_id, target_anchor.id 
			FROM 
			node source_node, 
			node target_node
			INNER JOIN shape_anchor source_anchor
			ON source_anchor.shape_id = source_node.shape_id
			INNER JOIN shape_anchor target_anchor
			ON target_anchor.shape_id = target_node.shape_id
			WHERE (source_node.id, target_node.id) = (:source_node_id, :target_node_id)
			AND (source_anchor.id, target_anchor.id) = (:source_anchor_id, :target_anchor_id)
			LIMIT 1
	 RETURNING ID`, {
		':element_id': elementId,
		':source_node_id': sourceNode,
		':source_anchor_id': sourceAnchor,
		':target_node_id': targetNode,
		':target_anchor_id': targetAnchor,
	});

	edgeId = stmt[0].values[0][0];
	if (!edgeId) {
		db.exec('ROLLBACK');
		throw new Exception(`Creating Edge failed`);
	} else { 
	    db.exec('COMMIT');
	}

	return [edgeId, elementId];
}

function createPathPoint(db, elementId, x,y) {
	const stmt = db.exec(`INSERT INTO path_point(element_id, x,y, sort)
		VALUES(:element_id, :x, :y, 0)
	 RETURNING ID`, {
		':element_id': elementId,
		':x': x,
		':y': y,
	});

	return [stmt[0].values[0][0], elementId];
}


function createText(db, elementId, content = '', x = 0, y = 0) {

	db.exec('BEGIN TRANSACTION');

	const stmt = db.exec(`INSERT INTO text
	(element_id, content, position_x, position_y) VALUES 
	(:element_id, :content, :position_x, :position_y)
	 RETURNING ID`, {
		':element_id': elementId,
		':content': content,
		':position_x': x,
		':position_y': y,
	});

	textId = stmt[0].values[0][0];

	if (!textId) {
		db.exec('ROLLBACK');
		throw new Exception(`Creating Edge failed`);
	} else { 
	    db.exec('COMMIT');
	}

	return textId;
}

function repair(db) {
	db.exec(`DELETE FROM element WHERE id IN (SELECT element_id FROM view_error_orphan_element)`);
	db.exec(`DELETE FROM text WHERE id IN (SELECT text_id FROM view_error_empty_text)`);
	db.exec(`DELETE FROM edge WHERE element_id IN (SELECT element_id FROM view_error_edge_node_conflict)`);
}

function doZoom(db, factor, center, min = 0.25, max= 4) {
	db.exec(`
		INSERT OR REPLACE INTO ui_camera_target(ui_camera_id, center_x, center_y, zoom)
		SELECT 
		id, 
		center_x+(:x/zoom)*(1-1/(MIN(MAX(:min, zoom*:factor), :max)/zoom)), 
		center_y+(:y/zoom)*(1-1/(MIN(MAX(:min, zoom*:factor), :max)/zoom)), 
		MIN(MAX(:min, zoom*:factor), :max)
		FROM ui_camera c
		WHERE c.id = 1`,
	{':factor':factor, ':x': center.x, ':y': center.y, ':min':min, ':max':max})
}

function doPan(db, dx, dy) {
	db.exec(`
		INSERT OR REPLACE INTO ui_camera_target(ui_camera_id, center_x, center_y, zoom)
		SELECT 
		c.id, 
		COALESCE(t.center_x, c.center_x)-(:dx/COALESCE(t.zoom, c.zoom)), 
		COALESCE(t.center_y, c.center_y)-(:dy/COALESCE(t.zoom, c.zoom)), 
		COALESCE(t.zoom, c.zoom)
		FROM ui_camera c
		LEFT JOIN ui_camera_target t
		ON t.ui_camera_id = c.id
		WHERE c.id = 1`,
	{':dx':dx,':dy':dy})
}

function stopPan(db) {
	db.exec(`DELETE FROM ui_camera_target`)
}

function clearSelect(db) {
	db.exec(`DELETE FROM ui_selection`)
}

function startSelect(db,x,y) {
	db.exec(`DELETE FROM ui_selection_box`)
	db.exec(`INSERT INTO ui_selection_box(ui_viewport_id, start_x, start_y, end_x, end_y) 
		VALUES(:vp, :x, :y,:x,:y)`,
		{':vp':1, ':x':x,':y':y})
}

function updateSelect(db,x,y) {
	db.exec(`UPDATE ui_selection_box SET end_x = :x, end_y = :y`,
		{':vp':1, ':x':x,':y':y})
	applySelect(db)
}

function stopSelect(db,x,y) {
	db.exec(`DELETE FROM ui_selection_box`)
}

function applySelect(db,x,y) {
	db.exec(`DELETE FROM ui_selection`)

	db.exec(`INSERT OR IGNORE INTO ui_selection (ui_viewport_id, element_id) 
		SELECT ui_viewport_id, element_id FROM view_elements_in_select_box
		`)
}

function hitTest(db, x,y) {
	const stmt = db.prepare(`SELECT 
		e.element_id AS element_id
		FROM view_bounded_element e
		LEFT JOIN ui_selection s 
		ON s.element_id = e.element_id
		WHERE (e.min_x <= :x AND e.max_x >= :x) AND
		      (e.min_y <= :y AND e.max_y >= :y)
		ORDER BY s.id IS NULL DESC
	`);
	stmt.bind({':x':x,':y':y})
	if(stmt.step()) {
		const r = stmt.getAsObject()
		stmt.free()
		return r
	} else {
		stmt.free()
		return null
	}
}

function addSelect(db,element_id) {
	db.exec(`INSERT OR IGNORE INTO ui_selection (ui_viewport_id, element_id) VALUES(1,:id)`,{':id':element_id})
}

function springCamera(db) {
	db.exec(`REPLACE INTO ui_camera (id, center_x, center_y, zoom)
		SELECT 
		c.id, 
		c.center_x * 0.2 + t.center_x * 0.8, 
		c.center_y * 0.2 + t.center_y * 0.8, 
		c.zoom * 0.2 + t.zoom * 0.8
		FROM ui_camera c
		INNER JOIN ui_camera_target t
		ON t.ui_camera_id = c.id
	`)
}

function loadExamples(db) {

	shapeId1 = createShape(db);
	shapeId2 = createShape(db);
	shapeId3 = createShape(db);

	anchor1 = createAnchor(db, shapeId1);
	anchor2 = createAnchor(db, shapeId1,0,0);
	anchor3 = createAnchor(db, shapeId1,0,1);
	anchor4 = createAnchor(db, shapeId1,1,0);
	anchor5 = createAnchor(db, shapeId1,1,1);

	n3 = createNode(db, 0,-30, shapeId1);
	n1 = createNode(db, 20,40, shapeId1);
	n2 = createNode(db, -50,80, shapeId1);

	e1 = createEdge(db, n1[0], anchor3, n2[0], anchor5);
	e2 = createEdge(db, n2[0], anchor2, n3[0], anchor2);
	createPathPoint(db, e2[1], -90, 0);
	createPathPoint(db, e1[1], 10, 100);

	t1 = createText(db, n1[1], `foo`,0,20);
	t2 = createText(db, n2[1], `foo`,0,-10);
	t3 = createText(db, e2[1], `foo`);

	t3 = createText(db, e2[1], ``);

	db.exec(`INSERT INTO element DEFAULT VALUES RETURNING ID`)[0].values[0][0];
	e3 = createEdge(db, n2[0], anchor2, n3[0], anchor2, n2[1]);

	const cmStmt = db.prepare(`INSERT INTO ui_camera(center_x,center_y,zoom) VALUES (
		:x,
		:y,
		:zoom) RETURNING ID`);
	const camId = cmStmt.getAsObject({':x':0,':y':0,':zoom':1}).id
	cmStmt.free()

	db.exec(`INSERT INTO ui_camera_physics(ui_camera_id) VALUES(:camId)`,{':camId':camId})

	const vpStmt = db.prepare(`INSERT INTO ui_viewport(width,height,ui_camera_id) VALUES (:w,:h,:camera_id)  RETURNING ID`);
	const vpId = vpStmt.getAsObject({':camera_id': camId, ':w': 1600, ':h': 1200}).id
	vpStmt.free()

	repair(db)
}