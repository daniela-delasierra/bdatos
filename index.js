const express = require('express');
var bodyParser = require('body-parser');
const neo4j = require('./neo4j');
const schema = require('./schemas/schema');

const app = express();
var jsonParser = bodyParser.json();

const PORT = process.env.PORT ?? 3000;

app.post('/persona', jsonParser, async (req, res) => {
  const session = neo4j.driver.session();
  try {
    const { error } = schema.personaSchema.validate(req.body);
    if (error) {
      return res.status(400).send(error.details[0].message);
    }
    const persona = req.body;
    const result = await session.run('MATCH (p:Persona {ci: $ci}) RETURN p', {
      ci: persona.ci,
    });

    if (result.records.length > 0) {
      res.status(401).send('La persona ya existe');
    } else {
      await session.run(
        'CREATE (p:Persona {ci: $ci, nombre: $nombre, apellido: $apellido, edad: $edad})',
        persona
      );
      res.status(200).send('Persona agregada');
    }
  } catch (error) {
    res.status(500).send(error.message);
  } finally {
    await session.close();
  }
});

app.post('/domicilio/:ci', bodyParser, async (req, res) => {
  const session = neo4j.driver.session();
  try {
    const { error } = schema.direccionSchema.validate(req.body);
    if (error) {
      return res.status(400).send(error.details[0].message);
    }
    const ci = req.params.ci;
    const domicilio = req.body;
    const result = await session.run('MATCH (p:Persona {ci: $ci}) RETURN p', {
      ci,
    });

    if (result.records.length === 0) {
      res
        .status(402)
        .send('No existe una persona con la cédula aportada como parámetro');
    } else {
      await session.run(
        'MATCH (p:Persona {ci: $ci}) CREATE (p)-[:RESIDE_EN]->(:Domicilio {departamento: $departamento, localidad: $localidad, calle: $calle, nro: $nro, apartamento: $apartamento, padron: $padron, ruta: $ruta, km: $km, letra: $letra, barrio: $barrio})',
        { ci, ...domicilio }
      );
      res.status(200).send('Domicilio agregado');
    }
  } catch (error) {
    res.status(500).send(error.message);
  } finally {
    await session.close();
  }
});

app.get('/domicilios/:ci', async (req, res) => {
  const session = neo4j.driver.session();
  try {
    const page = parseInt(req.query.page) || 1;
    const pageSize = parseInt(req.query.pageSize) || 10;
    const skip = (page - 1) * pageSize;
    const ci = req.params.ci;
    const result = await session.run(
      'MATCH (p:Persona {ci: $ci})-[:RESIDE_EN]->(d:Domicilio) RETURN d ORDER BY d.fechaCreacion DESC SKIP $skip LIMIT $limit',
      { ci, skip, limit: pageSize }
    );
    if (result.records.length === 0) {
      res
        .status(402)
        .send('No se han encontrado domicilios para la cédula proporcionada');
    } else {
      const domicilios = result.records.map(
        (record) => record.get('d').properties
      );
      res.status(200).json(domicilios);
    }
  } catch (error) {
    res.status(500).send(error.message);
  } finally {
    await session.close();
  }
});

app.get('/domicilios', async (req, res) => {
  const session = neo4j.driver.session();
  try {
    const { barrio, localidad, departamento } = req.query;
    const filterCondition = 'WHERE ';
    if (barrio) {
      filterCondition += `d.barrio = $barrio`;
    }
    if (localidad) {
      filterCondition += `d.localidad = $localidad`;
    }
    if (departamento) {
      filterCondition += `d.departamento =  $departamento`;
    }
    const query = `MATCH (d:Domicilio) ${filterCondition} RETURN d`; // Construye la consulta basada en los criterios
    const result = await session.run(query, {
      barrio,
      localidad,
      departamento,
    });

    const domicilios = result.records.map(
      (record) => record.get('d').properties
    );
    res.status(200).json(domicilios);
  } catch (error) {
    res.status(500).send(error.message);
  } finally {
    await session.close();
  }
});

app.listen(PORT, () => {
  console.log(`app running on port ${PORT}`);
});
