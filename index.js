require('dotenv').config();

const express = require('express');
const bodyParser = require('body-parser');
const neo4j = require('./neo4j');
const neo4jModule = require('neo4j-driver');
const schema = require('./schemas/schema');
const redisClient = require('./redisClient');

const ONLY_NUMBERS_REGEX = /^[0-9]+$/;
const app = express();
const jsonParser = bodyParser.json();

const PORT = process.env.PORT ?? 3000;

async function deleteCacheByPattern(pattern) {
  const keys = await redisClient.keys(pattern);
  console.log({ keys });
  if (keys.length === 0) return;

  const multi = redisClient.multi();
  keys.forEach((key) => {
    multi.del(key);
  });
  await multi.exec();
}

app.post('/persona', jsonParser, async (req, res) => {
  const session = neo4j.driver.session();
  try {
    const { error } = schema.personaSchema.validate(req.body);
    if (error || !ONLY_NUMBERS_REGEX.test(req.body.ci)) {
      return res.status(400).send(error.details[0].message);
    }
    const persona = req.body;
    console.log(persona.ci);
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

app.post('/domicilio/:ci', jsonParser, async (req, res) => {
  const session = neo4j.driver.session();
  try {
    const { error } = schema.direccionSchema.validate(req.body);
    if (error) {
      return res.status(400).send(error.details[0].message);
    }
    const ci = req.params.ci;
    const today = new Date();
    const created = neo4jModule.types.Date.fromStandardDate(today);
    const domicilio = req.body;
    const result = await session.run('MATCH (p:Persona {ci: $ci}) RETURN p', {
      ci,
    });

    if (result.records.length === 0) {
      res
        .status(402)
        .send('No existe una persona con la cédula aportada como parámetro');
    } else {
      let notRequiredFields = '';
      if (domicilio.padron) notRequiredFields += ', padron: $padron';
      if (domicilio.ruta) notRequiredFields += ', ruta: $ruta';
      if (domicilio.km) notRequiredFields += ', km: $km';
      if (domicilio.letra) notRequiredFields += ', letra: $letra';
      if (domicilio.barrio) notRequiredFields += ', barrio: $barrio';
      if (domicilio.apartamento)
        notRequiredFields += ', apartamento: $apartamento';
      await session.run(
        `MATCH (p:Persona {ci: $ci}) CREATE (p)-[:RESIDE_EN]->(:Domicilio {departamento: $departamento, localidad: $localidad, calle: $calle, nro: $nro, created: $created ${notRequiredFields}})`,
        { ci, created, ...domicilio }
      );
      deleteCacheByPattern('domicilios:*').catch(console.error);

      res.status(200).send('Domicilio agregado');
    }
  } catch (error) {
    res.status(500).send(error.message);
  } finally {
    await session.close();
  }
});

app.get('/domicilio/:ci', async (req, res) => {
  const session = neo4j.driver.session();
  const ci = req.params.ci;
  const cacheKey = `domicilios:${ci}`;
  const cachedData = await redisClient.get(cacheKey);
  if (cachedData) {
    console.log('seee');
    return res.status(200).json(JSON.parse(cachedData));
  } else {
    try {
      const page = neo4jModule.types.Integer.fromValue(
        parseInt(req.query.page) || 1
      );
      const pageSize = neo4jModule.types.Integer.fromValue(
        parseInt(req.query.pageSize) || 10
      );
      const skip = neo4jModule.types.Integer.fromValue(
        page.subtract(1).multiply(pageSize)
      );
      const date = new Date();
      const created = neo4jModule.types.Date.fromStandardDate(date);
      const result = await session.run(
        'MATCH (p:Persona {ci: $ci})-[:RESIDE_EN]->(d:Domicilio) RETURN d ORDER BY d.created DESC SKIP $skip LIMIT $limit',
        { ci, created, skip, limit: pageSize }
      );
      if (result.records.length === 0) {
        res
          .status(402)
          .send('No se han encontrado domicilios para la cédula proporcionada');
      } else {
        const domicilios = result.records.map(
          (record) => record.get('d').properties
        );
        redisClient.set(cacheKey, JSON.stringify(domicilios)); // Cache for 1 hour
        res.status(200).json(domicilios);
      }
    } catch (error) {
      res.status(500).send(error.message);
    } finally {
      await session.close();
    }
  }
});

app.get('/domicilio', async (req, res) => {
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

        const query = `MATCH (d:Domicilio) ${filterConditionStr} OPTIONAL MATCH (d)<-[:RESIDE_EN]-(p:Persona) RETURN d, collect(p) as personas`;
        const result = await session.run(query, queryParams);

        const domicilios = result.records.map((record) => {
          const domicilio = record.get('d').properties;
          domicilio.personas = record
            .get('personas')
            .map((persona) => persona.properties);
          return domicilio;
        });

        const response = {
          domicilios,
        };
        await redisClient.set(cacheKey, JSON.stringify(response)); // Cache for 1 hour
        res.status(200).json(response);
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
