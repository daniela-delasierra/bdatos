const express = require('express');
var bodyParser = require('body-parser');
const neo4j = require('./neo4j');
const schema = require('./schemas/schema');
const redisClient = require('./redisClient');

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
  const ci = req.params.ci;
  const cacheKey = `domicilios:${ci}`;

  redisClient.get(cacheKey, async (err, data) => {
    if (err) throw err;

    if (data) {
      return res.status(200).json(JSON.parse(data));
    } else {
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
            .send(
              'No se han encontrado domicilios para la cédula proporcionada'
            );
        } else {
          const domicilios = result.records.map(
            (record) => record.get('d').properties
          );
          redisClient.set(cacheKey, 3600, JSON.stringify(domicilios)); // Cache for 1 hour
          res.status(200).json(domicilios);
        }
      } catch (error) {
        res.status(500).send(error.message);
      } finally {
        await session.close();
      }
    }
  });
});
app.get('/domicilios', async (req, res) => {
  const { barrio, localidad, departamento } = req.query;
  const cacheKey = `domicilios:all:${barrio}:${localidad}:${departamento}`;

  try {
    const cachedData = await redisClient.get(cacheKey);

    if (cachedData) {
      return res.status(200).json(JSON.parse(cachedData));
    } else {
      const session = neo4j.driver.session();
      try {
        let filterConditions = [];
        let queryParams = {};

        if (barrio) {
          filterConditions.push(`d.barrio = $barrio`);
          queryParams.barrio = barrio;
        }
        if (localidad) {
          filterConditions.push(`d.localidad = $localidad`);
          queryParams.localidad = localidad;
        }
        if (departamento) {
          filterConditions.push(`d.departamento = $departamento`);
          queryParams.departamento = departamento;
        }

        let filterConditionStr =
          filterConditions.length > 0
            ? 'WHERE ' + filterConditions.join(' AND ')
            : '';
        const query = `MATCH (d:Domicilio) ${filterConditionStr} RETURN d`;
        const result = await session.run(query, queryParams);

        const domicilios = result.records.map(
          (record) => record.get('d').properties
        );
        await redisClient.set(cacheKey, 3600, JSON.stringify(domicilios)); // Cache for 1 hour
        res.status(200).json(domicilios);
      } catch (error) {
        res.status(500).send(error.message);
      } finally {
        await session.close();
      }
    }
  } catch (error) {
    console.error('Redis error:', error);
    res.status(500).send('Server error');
  }
});

app.listen(PORT, () => {
  console.log(`app running on port ${PORT}`);
});
