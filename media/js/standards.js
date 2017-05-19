/* global Backbone: true, _: true, jQuery: true, Papa: true */

var Lens = Backbone.Model.extend({
    defaults: {
        name: '',
        description: ''
    },
    toTemplate: function() {
        return _(this.attributes).clone();
    }
});

var LensList = Backbone.Collection.extend({
    model: Lens,
    toTemplate: function() {
        var a = [];
        this.forEach(function(item) {
            a.push(item.toTemplate());
        });
        return a;
    },
    byName: function(name) {
        return this.findWhere({name: name});
    },
});

var Standard = Backbone.Model.extend(
    {
        defaults: {
        },
        toTemplate: function() {
            return _(this.attributes).clone();
        }
    },
    {
        FIELD_ACTIVE: 'Active (y/n)',
        FIELD_LENS_NAME: 'Lens',
        FIELD_LENS_DESCRIPTION: 'Lens_Description',
        FIELD_MASTERY: 'Mastery'
    }
);

var StandardList = Backbone.Collection.extend({
    model: Standard,
    initialize: function(lst) {
        if (lst !== undefined && lst instanceof Array) {
            for (var i = 0; i < lst.length; i++) {
                var x = new Standard(lst[i]);
                this.add(x);
            }
        }
    },
    toTemplate: function() {
        var a = [];
        this.forEach(function(item) {
            a.push(item.toTemplate());
        });
        return a;
    },
    byId: function(id) {
        return this.findWhere({id: id});
    },
    byTypeAndMastery: function(type, mastery) {
        var ctx = {};
        ctx[Standard.FIELD_MASTERY] = mastery;
        if (type) {
            ctx[Standard.FIELD_LENS_NAME] = type;
        }

        var a = this.where(ctx);
        for (var i = 0; i < a.length; i++) {
            a[i] = a[i].toTemplate();
        }

        return a;
    }
});

var State = Backbone.Model.extend({
    defaults: {
        activeStandard: undefined,
        activeLens: undefined
    },
    initialize: function(description) {
        var allLens = new Lens({
            name: 'All Competencies',
            href: 'all_competencies',
            description: description
        });

        var lenses = new LensList([allLens]);
        this.set('lenses', lenses);

        this.set('standards', new StandardList());
    },
    initStandards: function(results) {
        for (var i = 0; i < results.data.length; i++) {
            if (!this.validStandard(results.data[i])) {
                continue;
            }

            var std = new Standard(results.data[i]);
            std.set('id', i);
            this.get('standards').add(std);

            var lensName = results.data[i][Standard.FIELD_LENS_NAME];
            if (lensName.length > 0 && !this.get('lenses').byName(lensName)) {
                var lens = new Lens({
                    name: lensName,
                    filter: lensName,
                    href: this.slugify(lensName),
                    description:
                        results.data[i][Standard.FIELD_LENS_DESCRIPTION]
                });
                this.get('lenses').add(lens);
            }
        }
        this.set('activeLens', this.get('lenses').at(0));
    },
    context: function() {
        var filter = this.get('activeLens').get('filter');
        var standards = this.get('standards');
        var ctx = {
            'mastery': [
                standards.byTypeAndMastery(filter, '1'),
                standards.byTypeAndMastery(filter, '2'),
                standards.byTypeAndMastery(filter, '3')
             ],
            'lenses': this.get('lenses').toTemplate(),
            'activeLens': this.get('activeLens').toTemplate()
        };

        var std = this.get('activeStandard');
        if (std) {
            ctx.activeStandard = std.toTemplate();
        }
        return ctx;
    },
    slugify: function(str) {
        return str.toLowerCase().replace(/[^\w ]+/g, '').replace(/ +/g, '-');
    },
    validStandard: function(row) {
        var value = row[Standard.FIELD_ACTIVE];
        return value === 'y' || value === 'Y';
    }
});

var StandardView = Backbone.View.extend({
    events: {
        'click a[href="#"]': 'passiveClick',
        'click a.nav-link': 'onLens',
        'click .competency-detail': 'onShowDetail'
    },
    initialize: function(options) {
        _.bindAll(this, 'render', 'onLens', 'onShowDetail', 'onHideDetail',
            'addHistory', 'popHistory');

        this.state = new State(options.allDescription);
        this.state.on('change:activeStandard', this.render);
        this.state.on('change:activeLens', this.render);

        jQuery('#competency-detail-modal').on(
            'hidden.bs.modal', this.onHideDetail);

        this.lensTemplate = _.template(options.lensTemplate.html());
        this.standardsTemplate = _.template(options.standardsTemplate.html());
        this.detailTemplate = _.template(options.detailTemplate.html());

        var self = this;
        Papa.parse(options.url, {
            download: true,
            header: true,
            complete: function(results) {
                self.state.initStandards(results);
            }
        });
    },
    addHistory: function(lens, standard) {
    },
    popHistory: function() {
    },
    render: function() {
        var ctx = this.state.context();

        var $elt = this.$el.find('.standards-container');
        $elt.html(this.standardsTemplate(ctx));

        $elt = this.$el.find('.lens-container');
        $elt.html(this.lensTemplate(ctx));

        this.$el.find('.grid').masonry({
            // options
            itemSelector: '.grid-item',
            columnWidth: 220,
            transitionDuration: '0.2s'
        });

        if (ctx.activeStandard) {
            var $modal = jQuery('#competency-detail-modal');
            $modal.find('.modal-body').html(this.detailTemplate(ctx));
            $modal.modal('show');
        }
    },
    onLens: function(evt) {
        evt.preventDefault();
        var lensName = jQuery(evt.currentTarget).data('name');
        var lens = this.state.get('lenses').byName(lensName);
        this.state.set('activeLens', lens);
    },
    onShowDetail: function(evt) {
        evt.preventDefault();
        var id = jQuery(evt.currentTarget).data('id');
        var std = this.state.get('standards').byId(id);
        this.state.set('activeStandard', std);
    },
    onHideDetail: function(evt) {
        this.state.set('activeStandard', undefined);
    }
});
