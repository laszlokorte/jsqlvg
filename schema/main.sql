CREATE TABLE test(
	id INTEGER PRIMARY KEY AUTOINCREMENT, 
	x INTEGER NO NULL, 
	y INTEGER NOT NULL, 
	size INTEGER NOT NULL DEFAULT 5,
	color TEXT NOT NULL DEFAULT 'black'
);

PRAGMA foreign_keys = ON;

CREATE TABLE ui_camera (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	center_x NUMBER NOT NULL DEFAULT 0,
	center_y NUMBER NOT NULL DEFAULT 0,
	zoom NUMBER NOT NULL DEFAULT 1
);

CREATE TABLE ui_viewport (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	ui_camera_id INTEGER NOT NULL,
	width NUMBER NOT NULL DEFAULT 0,
	height NUMBER NOT NULL DEFAULT 0,

	CONSTRAINT fk_camera_id FOREIGN KEY (ui_camera_id) REFERENCES ui_camera(id)
);

CREATE TABLE ui_selection_box (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	ui_viewport_id INTEGER NOT NULL UNIQUE,
	start_x NUMBER NOT NULL,
	start_y NUMBER NOT NULL,
	end_x NUMBER NOT NULL,
	end_y NUMBER NOT NULL,

	CONSTRAINT unq_ui_viewport_id UNIQUE (ui_viewport_id),
	CONSTRAINT fk_viewport_id FOREIGN KEY (ui_viewport_id) REFERENCES ui_viewport(id)
);

CREATE TABLE ui_selection (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	ui_viewport_id INTEGER NOT NULL,
	element_id INTEGER NOT NULL,

	CONSTRAINT unq_ui_viewport_id UNIQUE (ui_viewport_id, element_id),
	CONSTRAINT fk_viewport_id FOREIGN KEY (ui_viewport_id) REFERENCES ui_viewport(id)
	CONSTRAINT fk_element_id FOREIGN KEY (element_id) REFERENCES element(id) ON DELETE CASCADE
);

CREATE TABLE element (
id INTEGER PRIMARY KEY AUTOINCREMENT
);

CREATE TABLE shape (
id INTEGER PRIMARY KEY AUTOINCREMENT,
base_width INTEGER NOT NULL DEFAULT 50,
base_height INTEGER NOT NULL DEFAULT 50
);


CREATE TABLE shape_path (
id INTEGER PRIMARY KEY AUTOINCREMENT,
shape_id INTEGER NOT NULL,
CONSTRAINT fk_shape_id FOREIGN KEY (shape_id) REFERENCES shape(id) ON DELETE CASCADE
);

CREATE TABLE shape_anchor (
id INTEGER PRIMARY KEY AUTOINCREMENT,
shape_id INTEGER NOT NULL,
width INTEGER NOT NULL DEFAULT 10,
height INTEGER NOT NULL DEFAULT 10,
relative_x NUMBER NOT NULL,
relative_y NUMBER NOT NULL,
offset_x NUMBER NOT NULL DEFAULT 0,
offset_y NUMBER NOT NULL DEFAULT 0,

CONSTRAINT unq_id_shape_id UNIQUE (shape_id, id),
CONSTRAINT fk_shape_id FOREIGN KEY (shape_id) REFERENCES shape(id) ON DELETE CASCADE
);

CREATE TABLE node (
id INTEGER PRIMARY KEY AUTOINCREMENT,
element_id INTEGER NOT NULL,
shape_id INTEGER NOT NULL,
position_x INTEGER NOT NULL,
position_y INTEGER NOT NULL,

CONSTRAINT unq_element_id UNIQUE (element_id),
CONSTRAINT unq_element_id UNIQUE (id, shape_id),
CONSTRAINT fk_element_id FOREIGN KEY (element_id) REFERENCES element(id) ON DELETE CASCADE,
CONSTRAINT fk_shape_id FOREIGN KEY (shape_id) REFERENCES shape(id) ON DELETE CASCADE
);

CREATE TABLE node_dimensions (
id INTEGER PRIMARY KEY AUTOINCREMENT,
node_id INTEGER NOT NULL,
width INTEGER NOT NULL,
height INTEGER NOT NULL,

CONSTRAINT unq_node_id UNIQUE (node_id),
CONSTRAINT fk_node_id FOREIGN KEY (node_id) REFERENCES node(id) ON DELETE CASCADE
);

CREATE TABLE text (
id INTEGER PRIMARY KEY AUTOINCREMENT,
element_id INTEGER NOT NULL,
content TEXT,
position_x INTEGER NOT NULL,
position_y INTEGER NOT NULL,

CONSTRAINT fk_element_id FOREIGN KEY (element_id) REFERENCES element(id) ON DELETE CASCADE
);

CREATE TABLE text_dimension (
id INTEGER PRIMARY KEY AUTOINCREMENT,
text_id INTEGER NOT NULL,
width INTEGER NOT NULL,
height INTEGER NOT NULL,

CONSTRAINT unq_text_id UNIQUE (text_id),
CONSTRAINT fk_text_id FOREIGN KEY (text_id) REFERENCES text(id) ON DELETE CASCADE
);

CREATE TABLE edge (
id INTEGER PRIMARY KEY AUTOINCREMENT,
element_id INTEGER NOT NULL,
source_node_id INTEGER NOT NULL,
source_shape_id INTEGER NOT NULL,
source_anchor_id INTEGER NOT NULL,
target_node_id INTEGER NOT NULL,
target_shape_id INTEGER NOT NULL,
target_anchor_id INTEGER NOT NULL,

CONSTRAINT unq_element_id UNIQUE (element_id),
CONSTRAINT fk_element_id FOREIGN KEY (element_id) REFERENCES element(id) ON DELETE CASCADE,
CONSTRAINT fk_source_id FOREIGN KEY (source_node_id, source_shape_id) REFERENCES node(id, shape_id) ON DELETE CASCADE,
CONSTRAINT fk_target_id FOREIGN KEY (target_node_id, target_shape_id) REFERENCES node(id, shape_id) ON DELETE CASCADE,
CONSTRAINT fk_source_anchor_id FOREIGN KEY (source_shape_id, source_anchor_id) REFERENCES shape_anchor(shape_id, id) ON DELETE CASCADE,
CONSTRAINT fk_target_anchor_id FOREIGN KEY (target_shape_id, target_anchor_id) REFERENCES shape_anchor(shape_id, id) ON DELETE CASCADE
);

CREATE TABLE path_point(
id INTEGER PRIMARY KEY AUTOINCREMENT,
element_id INTEGER NOT NULL,
x INTEGER NOT NULL,
y INTEGER NOT NULL,
sort INTEGER NOT NULL,

CONSTRAINT unq_element_id_sort UNIQUE (element_id, sort),
CONSTRAINT fk_element_id FOREIGN KEY (element_id) REFERENCES element(id) ON DELETE CASCADE
);

CREATE TABLE text_style (
id INTEGER PRIMARY KEY AUTOINCREMENT,
text_id INTEGER NOT NULL,

CONSTRAINT unq_text_id_sort UNIQUE (text_id),
CONSTRAINT fk_text_id FOREIGN KEY (text_id) REFERENCES text(id) ON DELETE CASCADE
);

CREATE TABLE edge_style (
id INTEGER PRIMARY KEY AUTOINCREMENT,
edge_id INTEGER NOT NULL,

CONSTRAINT unq_edge_id_sort UNIQUE (edge_id),
CONSTRAINT fk_edge_id FOREIGN KEY (edge_id) REFERENCES edge(id) ON DELETE CASCADE
);

CREATE TABLE node_style (
id INTEGER PRIMARY KEY AUTOINCREMENT,
node_id INTEGER NOT NULL,

CONSTRAINT unq_node_id_sort UNIQUE (node_id),
CONSTRAINT fk_node_id FOREIGN KEY (node_id) REFERENCES node(id) ON DELETE CASCADE
);

CREATE VIEW view_positioned_node AS 
SELECT 
id AS node_id, 
element_id,
position_x, 
position_y, 
shape_id 
FROM node;

CREATE VIEW view_sized_node AS 
SELECT 
n.id AS node_id,
COALESCE(node_dimensions.width, shape.base_width) AS width,
COALESCE(node_dimensions.height, shape.base_height) AS height
FROM node n
INNER JOIN shape
ON shape.id = n.shape_id
LEFT JOIN node_dimensions
ON node_dimensions.node_id = n.id;


CREATE VIEW view_bounded_node AS 
SELECT 
p.node_id AS node_id,
p.element_id AS element_id,
s.width AS width,
s.height AS height,
p.position_x - s.width/2 as min_x,
p.position_x + s.width/2 as max_x,
p.position_y - s.height/2 as min_y,
p.position_y + s.height/2 as max_y
FROM view_sized_node s
INNER JOIN view_positioned_node p
ON p.node_id = s.node_id;

CREATE VIEW view_positioned_anchor AS 
SELECT 
b.node_id AS node_id,
a.id AS anchor_id,
(b.max_x * a.relative_x) + (b.min_x * (1-a.relative_x)) + a.offset_x AS center_x,
(b.max_y * a.relative_y) + (b.min_y * (1-a.relative_y)) + a.offset_y AS center_y
FROM view_bounded_node b
INNER JOIN node
ON node.id = b.node_id
LEFT JOIN shape_anchor a
ON a.shape_id = node.shape_id;

CREATE VIEW view_bounded_anchor AS
SELECT 
p.anchor_id,
p.node_id,
a.width AS width,
a.height AS height,
p.center_x - a.width/2 as min_x,
p.center_x + a.width/2 as max_x,
p.center_y - a.height/2 as min_y,
p.center_y + a.height/2 as max_y
FROM view_positioned_anchor p
INNER JOIN shape_anchor a
ON a.id = p.anchor_id;

CREATE VIEW view_positioned_edge AS SELECT
edge.id AS edge_id,
edge.element_id AS element_id,
source_anchor.center_x AS source_x,
source_anchor.center_y AS source_y,
target_anchor.center_x AS target_x,
target_anchor.center_y AS target_y
FROM edge
INNER JOIN view_positioned_anchor source_anchor
ON (edge.source_node_id, edge.source_anchor_id) = (source_anchor.node_id, source_anchor.anchor_id)
INNER JOIN view_positioned_anchor target_anchor
ON (edge.target_node_id, edge.target_anchor_id) = (target_anchor.node_id, target_anchor.anchor_id);

CREATE VIEW view_positioned_shaped_edge AS SELECT
e.edge_id AS edge_id,
e.element_id AS element_id,
(COALESCE(SUM(p.x), 0) + source_x + target_x)/(count(p.id)+2) AS weighted_center_x,
(COALESCE(SUM(p.y), 0) + source_y + target_y)/(count(p.id)+2) AS weighted_center_y
FROM view_positioned_edge e
LEFT JOIN path_point p
ON p.element_id = e.element_id
GROUP BY e.element_id;

CREATE VIEW view_bounded_edge AS 
SELECT 
e.edge_id AS edge_id,
e.element_id AS element_id,
source_x,
source_y,
target_x,
target_y,
JSON_GROUP_ARRAY(JSON_OBJECT('x', p.x, 'y', p.y)) FILTER (where p.id) AS points,
MIN(COALESCE(MIN(p.x), source_x), source_x, target_x) as min_x,
MAX(COALESCE(MAX(p.x), source_x), source_x, target_x) as max_x,
MIN(COALESCE(MIN(p.y), source_y), source_y, target_y) as min_y,
MAX(COALESCE(MAX(p.y), source_y), source_y, target_y) as max_y
FROM view_positioned_edge e
LEFT JOIN path_point p
ON p.element_id = e.element_id
GROUP BY e.element_id;

CREATE VIEW view_positioned_text AS 
SELECT 
t.element_id,
t.id as text_id,
t.content as content,
t.position_x + COALESCE(node.position_x, COALESCE(e.weighted_center_x, 0)) AS center_x,
t.position_y + COALESCE(node.position_y, COALESCE(e.weighted_center_y, 0)) AS center_y
FROM "text" t
LEFT JOIN node
ON node.element_id = t.element_id
LEFT JOIN view_positioned_shaped_edge e
ON e.element_id = t.element_id;

CREATE VIEW view_bounded_text AS
SELECT
element_id,
p.text_id AS text_id,
center_x,
center_y,
content,
center_x - d.width AS min_x,
center_x + d.width AS max_x,
center_y - d.height AS min_y,
center_y + d.height AS max_y
FROM view_positioned_text p
LEFT JOIN text_dimension d
ON p.text_id = d.text_id;

CREATE VIEW view_error_empty_text AS 
SELECT 
element_id,
text.id AS text_id
FROM "text" 
WHERE TRIM("text".content) = "";

CREATE VIEW view_error_edge_node_conflict AS 
SELECT edge.element_id as element_id
FROM edge
INNER JOIN node
ON (edge.element_id, edge.source_node_id) = (node.element_id, node.id)
OR (edge.element_id, edge.target_node_id) = (node.element_id, node.id);

CREATE VIEW view_error_orphan_element AS 
SELECT element.id as element_id
FROM element
LEFT JOIN node ON node.element_id = element.id
LEFT JOIN edge ON edge.element_id = element.id
LEFT JOIN "text" ON text.element_id = element.id
WHERE node.id IS NULL AND edge.id IS NULL AND "text".id IS NULL;

CREATE VIEW view_error_report AS
SELECT
"Text is empty" AS error,
element_id AS element_id
FROM view_error_empty_text
UNION
SELECT
"Edge/Node Conflict"AS error,
element_id AS element_id
FROM view_error_edge_node_conflict
UNION
SELECT
"Orphan element" as error,
element_id AS element_id
FROM view_error_orphan_element;


CREATE VIEW view_bounded_node_from_camera AS
SELECT 
c.id AS camera_id,
n.node_id AS node_id,
n.element_id AS element_id,
n.width*c.zoom AS width,
n.height*c.zoom AS height,
(n.min_x - c.center_x)*c.zoom AS min_x,
(n.max_x - c.center_x)*c.zoom AS max_x,
(n.min_y - c.center_y)*c.zoom AS min_y,
(n.max_y - c.center_y)*c.zoom AS max_y
FROM 
view_bounded_node n, 
ui_camera c; 


CREATE VIEW view_bounded_anchor_from_camera AS
SELECT 
c.id AS camera_id,
a.anchor_id AS anchor_id,
a.node_id AS node_id,
a.width*c.zoom AS width,
a.height*c.zoom AS height,
(a.min_x - c.center_x)*c.zoom AS min_x,
(a.max_x - c.center_x)*c.zoom AS max_x,
(a.min_y - c.center_y)*c.zoom AS min_y,
(a.max_y - c.center_y)*c.zoom AS max_y
FROM view_bounded_anchor a, 
ui_camera c; 


CREATE VIEW view_bounded_edge_from_camera AS
SELECT 
c.id AS camera_id,
e.edge_id AS edge_id,
e.element_id AS element_id,
(e.source_x - c.center_x)*c.zoom AS source_x,
(e.source_y - c.center_y)*c.zoom AS source_y,
(e.target_x - c.center_x)*c.zoom AS target_x,
(e.target_y - c.center_y)*c.zoom AS target_y,
(SELECT JSON_GROUP_ARRAY(
	JSON_OBJECT(
		'x', (json_extract(m.value,'$.x') - c.center_x)*c.zoom, 
		'y', (json_extract(m.value,'$.y') - c.center_y)*c.zoom
	)) FROM JSON_EACH(e.points) m
) AS points,
(e.min_x - c.center_x)*c.zoom AS min_x,
(e.max_x - c.center_x)*c.zoom AS max_x,
(e.min_y - c.center_y)*c.zoom AS min_y,
(e.max_y - c.center_y)*c.zoom AS max_y
FROM view_bounded_edge e, 
ui_camera c; 


CREATE VIEW view_bounded_text_from_camera AS
SELECT
c.id AS camera_id,
t.element_id AS element_id,
t.text_id AS text_id,
(t.center_x - c.center_x)*c.zoom AS center_x,
(t.center_y - c.center_y)*c.zoom AS center_y,
t.content AS content,
(t.min_x - c.center_x)*c.zoom AS min_x,
(t.max_x - c.center_x)*c.zoom AS max_x,
(t.min_y - c.center_y)*c.zoom AS min_y,
(t.max_y - c.center_y)*c.zoom AS max_y,
12 * c.zoom AS font_size_absolute,
12 * c.zoom AS font_size_relative
FROM view_bounded_text t, 
ui_camera c; 

CREATE VIEW view_bounded_ui_viewport AS
SELECT 
v.id AS id,
ui_camera_id AS camera_id,
-v.width/2 AS min_x,
v.width/2 AS max_x,
-v.height/2 AS min_y,
v.height/2 AS max_y,
v.width AS width,
v.height AS height,
c.center_x-v.width/2/c.zoom AS world_min_x,
c.center_x+v.width/2/c.zoom AS world_max_x,
c.center_y-v.height/2/c.zoom AS world_min_y,
c.center_y+v.height/2/c.zoom AS world_max_y,
v.width/c.zoom AS world_width,
v.height/c.zoom AS world_height,
c.zoom AS scale
FROM ui_viewport v
INNER JOIN ui_camera c
ON c.id = v.ui_camera_id;

CREATE VIEW view_bounded_node_in_viewport AS
SELECT 
v.id AS viewport_id,
n.*,
(n.min_x <= v.max_x AND n.max_x >= v.min_x) AND
      (n.min_y <= v.max_y AND n.max_y >= v.min_y) AS in_viewport
FROM view_bounded_ui_viewport v
INNER JOIN view_bounded_node_from_camera n
ON n.camera_id = v.camera_id;

CREATE VIEW view_bounded_anchor_in_viewport AS
SELECT 
v.id AS viewport_id,
a.*,
(a.min_x <= v.max_x AND a.max_x >= v.min_x) AND
      (a.min_y <= v.max_y AND a.max_y >= v.min_y) AS in_viewport
FROM view_bounded_ui_viewport v
INNER JOIN view_bounded_anchor_from_camera a
ON a.camera_id = v.camera_id;

CREATE VIEW view_bounded_edge_in_viewport AS
SELECT 
v.id AS viewport_id,
e.*,
(e.min_x <= v.max_x AND e.max_x >= v.min_x) AND
      (e.min_y <= v.max_y AND e.max_y >= v.min_y) AS in_viewport
FROM view_bounded_ui_viewport v
INNER JOIN view_bounded_edge_from_camera e
ON e.camera_id = v.camera_id;

CREATE VIEW view_bounded_text_in_viewport AS
SELECT 
v.id AS viewport_id,
t.*,
(COALESCE(t.min_x, t.center_x) <= v.max_x AND COALESCE(t.max_x, t.center_x) >= v.min_x) AND
(COALESCE(t.min_y, t.center_y) <= v.max_y AND COALESCE(t.max_y, t.center_y) >= v.min_y) AS in_viewport
FROM view_bounded_ui_viewport v
INNER JOIN view_bounded_text_from_camera t
ON t.camera_id = v.camera_id;

CREATE VIEW view_ui_selection_box AS
SELECT 
ui_selection_box.id,
ui_viewport_id,
MIN(start_x, end_x)/c.zoom+c.center_x AS min_x,
MAX(start_x, end_x)/c.zoom+c.center_x AS max_x,
MIN(start_y, end_y)/c.zoom+c.center_y AS min_y,
MAX(start_y, end_y)/c.zoom+c.center_y AS max_y
FROM ui_selection_box
INNER JOIN ui_viewport v
ON v.id = ui_selection_box.ui_viewport_id
INNER JOIN ui_camera c
ON c.id = v.ui_camera_id;

CREATE VIEW view_bounded_element AS
SELECT element_id,min_x,max_x,min_y,max_y FROM view_bounded_node e
UNION
SELECT element_id,min_x,max_x,min_y,max_y FROM view_bounded_edge e
UNION
SELECT element_id,COALESCE(min_x, center_x),COALESCE(max_x, center_x),COALESCE(min_y, center_y),COALESCE(max_y, center_y) FROM view_bounded_text e;

CREATE VIEW view_elements_in_select_box AS
SELECT e.element_id AS element_id,
s.ui_viewport_id AS ui_viewport_id
FROM view_bounded_element e
INNER JOIN view_ui_selection_box s
WHERE (e.min_x <= s.max_x AND e.max_x >= s.min_x) AND
      (e.min_y <= s.max_y AND e.max_y >= s.min_y)
