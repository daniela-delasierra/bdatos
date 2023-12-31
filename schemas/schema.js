const Joi = require('@hapi/joi');

const personaSchema = Joi.object({
    ci: Joi.string().min(7).max(8).required(),
    nombre: Joi.string().min(3).max(30).required(),
    apellido: Joi.string().min(3).max(30).required(),
    edad: Joi.number().integer().min(0).max(120).required()
  });
  
  const direccionSchema = Joi.object({
    departamento: Joi.string().required(),
    localidad: Joi.string().required(),
    calle: Joi.string().required(),
    nro: Joi.number().integer().min(1).required(),
    apartamento: Joi.number().integer().min(1),
    padron: Joi.string(),
    ruta: Joi.string(),
    km: Joi.string(),
    letra: Joi.string(),
    barrio: Joi.string()
  });
  
  const domicilioSchema = Joi.object({
    datosPersona: personaSchema,
    direccion: direccionSchema
  });
  
  exports.personaSchema = personaSchema;
  exports.direccionSchema = direccionSchema;
  exports.domicilioSchema = domicilioSchema;

