import React from "react";
import { Accordion, Badge, Card, Col, Form, Row } from "react-bootstrap";

export function Field({ label, children }) {
  return (
    <Form.Group as={Row} className="mb-2 align-items-center">
      <Form.Label column sm={3} className="text-secondary">
        {label}
      </Form.Label>
      <Col sm={9} className="d-flex gap-2 align-items-center">
        {children}
      </Col>
    </Form.Group>
  );
}

export function GrowTextarea({ value, onChange, placeholder, minRows = 2 }) {
  const ref = React.useRef(null);
  React.useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [value]);
  return (
    <Form.Control
      as="textarea"
      ref={ref}
      className="font-monospace"
      style={{ resize: "none", overflow: "hidden", fontSize: "0.85rem" }}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      rows={minRows}
    />
  );
}

export function SectionHead({ title, href, children }) {
  return (
    <Card.Header className="d-flex align-items-center gap-2">
      <span className="fw-semibold">{title}</span>
      {href && (
        <a href={href} target="_blank" rel="noreferrer" className="small">
          docs
        </a>
      )}
      <span className="ms-auto">{children}</span>
    </Card.Header>
  );
}

const STATES = {
  disabled: ["secondary", "Disabled"],
  error: ["danger", "Error"],
  starting: ["warning", "Starting"],
  running: ["success", "Running"],
  stopped: ["secondary", "Stopped"],
};

export function StatusBadge({ state }) {
  const [bg, label] = STATES[state] || STATES.stopped;
  return <Badge bg={bg}>{label}</Badge>;
}

export function ComponentLog({ name, log }) {
  const output = React.useRef(null);
  React.useLayoutEffect(() => {
    if (output.current) output.current.scrollTop = output.current.scrollHeight;
  }, [log]);

  if (!log) return null;
  return (
    <Accordion className="mt-3">
      <Accordion.Item eventKey="log">
        <Accordion.Header>{name} logs</Accordion.Header>
        <Accordion.Body>
          <pre
            ref={output}
            className="mb-0 small"
            style={{ whiteSpace: "pre-wrap", maxHeight: "240px" }}
          >
            {log}
          </pre>
        </Accordion.Body>
      </Accordion.Item>
    </Accordion>
  );
}
