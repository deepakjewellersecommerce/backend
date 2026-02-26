const z = require('zod');
const { fromZodError } = require('zod-validation-error');

const validate = (schema) => (req, res, next) => {
    const result = schema.safeParse({
        body: req.body,
        query: req.query,
        params: req.params,
    });

    if (result.success === false) {
        console.log(req.body);
        const formattedError = fromZodError(result.error).message;
        return res.status(400).json({ error: formattedError });
    }
    // Apply transformed values back (e.g. string→number coercion)
    if (result.data.body) req.body = result.data.body;
    if (result.data.query) req.query = result.data.query;
    if (result.data.params) req.params = result.data.params;
    next();
};

module.exports = validate;
