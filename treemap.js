const width = window.innerWidth;
const height = window.innerHeight;

const filePath = 'data.json';
const animationSpeed = 500;

let data;
let color = d3.scaleSequential([8, 0], d3.interpolateCool);

const treemap = data => d3.treemap()
                          .size([width, height])
                          .paddingOuter(5)
                          .paddingTop(20)
                          .paddingInner(1)
                          .round(true)
                          (d3.hierarchy(data)
                          .sum(d => d.value)
                          .sort((a, b) => b.value - a.value));

const uuidv4 = () => {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
        const r = Math.random() * 16 | 0;
        const v = c == 'x' ? r : (r & 0x3 | 0x8);

        return v.toString(16);
    });
}

const formatBytes = (bytes, decimals = 2) => {
    if (bytes === 0) return '0 Bytes';

    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];

    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

const zoom = (path, root) => {
    const name = path.split('.').splice(-1)[0];
    const normalizedPath = path.split('.')
                               .slice(1)
                               .join('.');

    const treemapData = normalizedPath.split('.').reduce((obj, path) => {
        let returnObject;
    
        obj.forEach(node => {
            if (node.name === path) {
                returnObject = node.children;
            }
        });
    
        return returnObject;
    }, root.children);

    render({
        name,
        children: treemapData
    });
}

const getPath = (element, separator) => element.ancestors().reverse().map(elem => elem.data.name).join(separator)

const render = data => {
    const root = treemap(data);
    
    const svg    = d3.select('.treemap');
    const newSvg = d3.select('.temp')
                     .attr('viewBox', [0, 0, width, height]);

    // Create shadow
    newSvg.append('filter')
          .attr('id', 'shadow')
          .append('feDropShadow')
          .attr('flood-opacity', 0.5)
          .attr('dx', 0)
          .attr('dy', 0)
          .attr('stdDeviation', 2);

    // Create node
    const node = newSvg.selectAll('g')
                       .data(d3.nest().key(d => d.height).entries(root.descendants()))
                       .join('g')
                       .attr('filter', 'url(#shadow)')
                       .selectAll('g')
                       .data(d => d.values)
                       .join('g')
                       .attr('transform', d => `translate(${d.x0},${d.y0})`);
    
    // Create title
    node.append('title')
        .text(d => {
            const path = getPath(d, '/');
            const icon = path.includes('.') ? '📋' : '🗂️';

            d.path = getPath(d, '.');

            return `${icon} ${getPath(d, '/')}\n${formatBytes(d.value)}`;
        });

    // Create rectangle
    node.append('rect')
        .attr('id', d => d.nodeId = uuidv4())
        .attr('fill', d => color(d.height))
        .attr('width', d => d.x1 - d.x0)
        .attr('height', d => d.y1 - d.y0);

    // Create clip path for text
    node.append('clipPath')
        .attr('id', d => d.clipId = uuidv4())
        .append('use')
        .attr('href', d => `#${d.nodeId}`);
    
    // Create labels
    node.append('text')
        .attr('clip-path', d => `url(#${d.clipId})`)
        .selectAll('tspan')
        .data(d => [d.data.name, formatBytes(d.value)])
        .join('tspan')
        .attr('fill-opacity', (d, i, nodes) => i === nodes.length - 1 ? 0.75 : null)
        .text(d => d);
    
    // Set position for parents
    node.filter(d => d.children)
        .selectAll('tspan')
        .attr('dx', 5)
        .attr('y', 15);
    
    // Set position for everything else that doesn't have children
    node.filter(d => !d.children)
        .selectAll('tspan')
        .attr('x', 3)
        .attr('y', (d, i, nodes) => i === nodes.length - 1 ? 30 : 15)

    // Add click event
    node.filter(d => d.children && d !== root)
        .attr('cursor', 'pointer')
        .on('click', d => zoom(d.path, data));

    // Fade out old svg
    svg.transition()
    // .ease(d3.easeCubicIn)
       .duration(animationSpeed)
       .attrTween('opacity', () => d3.interpolate(1, 0))

    // Fade in new svg
    newSvg.transition()
    // .ease(d3.easeCubicOut)
          .duration(animationSpeed)
          .attrTween('opacity', () => d3.interpolate(0, 1))
          .attr('class', 'treemap')
          .on('end', () => {
              // At the very end, swap classes and remove everything from the temporary svg
              svg.attr('class', 'temp').selectAll('*').remove();
          });

    d3.select('select').on('change', function () {
        color = d3.scaleSequential([8, 0], d3[d3.select(this).property('value')]);

        node.select('rect').attr('fill', d => color(d.height));
    });
};

(async () => {
    data = await d3.json(filePath).then(data => data);

    render(data);
    
    d3.select('button').on('click', () => render(data));
})();
