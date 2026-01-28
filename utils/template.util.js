const fs = require('fs-extra');
const path = require('path');
const Handlebars = require('handlebars');

async function renderTemplate(templateName, data) {
  const templatesDir = path.join(process.cwd(), 'templates');

  const layoutPath = path.join(templatesDir, 'layout.hbs');
  const templatePath = path.join(templatesDir, `${templateName}.hbs`);

  const layoutSource = await fs.readFile(layoutPath, 'utf8');
  const templateSource = await fs.readFile(templatePath, 'utf8');

  const body = Handlebars.compile(templateSource)(data);

  return Handlebars.compile(layoutSource)({
    title: data.title || 'Slotify',
    body,
    year: new Date().getFullYear(),
  });
}

module.exports = { renderTemplate };
