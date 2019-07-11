import Parse from 'parse/node';
import { GraphQLSchema, GraphQLObjectType } from 'graphql';
import { ApolloError } from 'apollo-server-core';
import requiredParameter from '../requiredParameter';
import * as defaultGraphQLTypes from './loaders/defaultGraphQLTypes';
import * as parseClassTypes from './loaders/parseClassTypes';
import * as parseClassQueries from './loaders/parseClassQueries';
import * as parseClassMutations from './loaders/parseClassMutations';
import * as defaultGraphQLQueries from './loaders/defaultGraphQLQueries';
import * as defaultGraphQLMutations from './loaders/defaultGraphQLMutations';
import GraphQLController from '../Controllers/GraphQLController';
import DatabaseController from '../Controllers/DatabaseController';

class ParseGraphQLSchema {
  databaseController: DatabaseController;
  graphQLController: GraphQLController;

  constructor(params: {
    databaseController: DatabaseController,
    graphQLController: GraphQLController,
    log: any,
  }) {
    this.graphQLController =
      params.graphQLController ||
      requiredParameter('You must provide a graphQLController instance!');
    this.databaseController =
      params.databaseController ||
      requiredParameter('You must provide a databaseController instance!');
    this.log =
      params.log || requiredParameter('You must provide a log instance!');
  }

  async load() {
    await this._initializeSchemaAndConfig();

    const parseClasses = await this._getClassesForSchema();
    const parseClassesString = JSON.stringify(parseClasses);

    if (this.graphQLSchema) {
      if (this.parseClasses === parseClasses) {
        return this.graphQLSchema;
      }

      if (this.parseClassesString === parseClassesString) {
        this.parseClasses = parseClasses;
        return this.graphQLSchema;
      }
    }

    this.parseClasses = parseClasses;
    this.parseClassesString = parseClassesString;
    this.parseClassTypes = {};
    this.meType = null;
    this.graphQLSchema = null;
    this.graphQLTypes = [];
    this.graphQLObjectsQueries = {};
    this.graphQLQueries = {};
    this.graphQLObjectsMutations = {};
    this.graphQLMutations = {};
    this.graphQLSubscriptions = {};

    defaultGraphQLTypes.load(this);

    this._getParseClassesWithConfig(parseClasses).forEach(
      ([parseClass, parseClassConfig]) => {
        parseClassTypes.load(this, parseClass, parseClassConfig);
        parseClassQueries.load(this, parseClass, parseClassConfig);
        parseClassMutations.load(this, parseClass, parseClassConfig);
      }
    );

    defaultGraphQLQueries.load(this);
    defaultGraphQLMutations.load(this);

    let graphQLQuery = undefined;
    if (Object.keys(this.graphQLQueries).length > 0) {
      const fields = this._getAllQueries();
      graphQLQuery = new GraphQLObjectType({
        name: 'Query',
        description: 'Query is the top level type for queries.',
        fields,
      });
      this.graphQLTypes.push(graphQLQuery);
    }

    let graphQLMutation = undefined;
    if (Object.keys(this.graphQLMutations).length > 0) {
      const fields = this._getAllMutations();
      graphQLMutation = new GraphQLObjectType({
        name: 'Mutation',
        description: 'Mutation is the top level type for mutations.',
        fields,
      });
      this.graphQLTypes.push(graphQLMutation);
    }

    let graphQLSubscription = undefined;
    if (Object.keys(this.graphQLSubscriptions).length > 0) {
      graphQLSubscription = new GraphQLObjectType({
        name: 'Subscription',
        description: 'Subscription is the top level type for subscriptions.',
        fields: this.graphQLSubscriptions,
      });
      this.graphQLTypes.push(graphQLSubscription);
    }

    this.graphQLSchema = new GraphQLSchema({
      types: this._mergeAdditionalTypes(this.graphQLTypes),
      query: graphQLQuery,
      mutation: graphQLMutation,
      subscription: graphQLSubscription,
    });

    return this.graphQLSchema;
  }

  handleError(error) {
    let code, message;
    if (error instanceof Parse.Error) {
      this.log.error('Parse error: ', error);
      code = error.code;
      message = error.message;
    } else {
      this.log.error('Uncaught internal server error.', error, error.stack);
      code = Parse.Error.INTERNAL_SERVER_ERROR;
      message = 'Internal server error.';
    }
    throw new ApolloError(message, code);
  }

  async _initializeSchemaAndConfig() {
    const [schemaController, parseGraphQLConfig] = await Promise.all([
      this.databaseController.loadSchema(),
      this.graphQLController.getGraphQLConfig(),
    ]);

    this.schemaController = schemaController;
    this.parseGraphQLConfig = parseGraphQLConfig || {};
  }

  /**
   * Gets all classes found by the `schemaController`
   * minus those filtered out by the app's parseGraphQLConfig.
   */
  async _getClassesForSchema() {
    const { enabledForClasses, disabledForClasses } = this.parseGraphQLConfig;
    const allClasses = await this.schemaController.getAllClasses();

    if (Array.isArray(enabledForClasses) || Array.isArray(disabledForClasses)) {
      let includedClasses = allClasses;
      if (enabledForClasses) {
        includedClasses = allClasses.filter(clazz => {
          return enabledForClasses.includes(clazz.className);
        });
      }
      if (disabledForClasses) {
        // Classes included in `enabledForClasses` that
        // are also present in `disabledForClasses` will
        // still be filtered out
        includedClasses = includedClasses.filter(clazz => {
          return !disabledForClasses.includes(clazz.className);
        });
      }

      this.isUsersClassDisabled = !includedClasses.some(clazz => {
        return clazz.className === '_User';
      });

      return includedClasses;
    } else {
      return allClasses;
    }
  }

  /**
   * This method returns a list of tuples
   * that provide the parseClass along with
   * its parseClassConfig where provided.
   */
  _getParseClassesWithConfig(parseClasses) {
    const { classConfigs } = this.parseGraphQLConfig;
    return parseClasses.map(parseClass => {
      let parseClassConfig;
      if (classConfigs) {
        parseClassConfig = classConfigs.find(
          c => c.className === parseClass.className
        );
      }
      return [parseClass, parseClassConfig];
    });
  }

  _storeAdditionalSchema() {
    const { additionalSchemaResolver: resolver } = this.parseGraphQLConfig;
    if (resolver) {
      this.additionalSchema = resolver();
    }
  }

  _getAllQueries() {
    const { graphQLQueries: baseQueryFields, additionalSchema } = this;
    if (additionalSchema && additionalSchema.query) {
      const { query: additionalQueryFields } = additionalSchema;
      const reservedKeys = ['users', 'objects', 'health'];
      if (
        Object.keys(additionalQueryFields).some(key =>
          reservedKeys.includes(key)
        )
      ) {
        throw new Error(
          `Additional graphql schema cannot use reserved query fields: ${reservedKeys}`
        );
      }
      return {
        ...baseQueryFields,
        ...additionalQueryFields,
      };
    } else {
      return baseQueryFields;
    }
  }

  _getAllMutations() {
    const { graphQLMutations: baseMutationFields, additionalSchema } = this;
    if (additionalSchema && additionalSchema.mutation) {
      const { mutation: additionalMutationFields } = additionalSchema;
      const reservedKeys = ['users', 'objects'];
      if (
        Object.keys(additionalMutationFields).some(key =>
          reservedKeys.includes(key)
        )
      ) {
        throw new Error(
          `Additional graphql schema cannot use reserved mutation fields: ${reservedKeys}`
        );
      }
      return {
        ...baseMutationFields,
        ...additionalMutationFields,
      };
    } else {
      return baseMutationFields;
    }
  }

  _mergeAdditionalTypes(baseTypes) {
    const { additionalSchema } = this;
    if (additionalSchema && Array.isArray(additionalSchema.types)) {
      const { types: additionalTypes } = additionalSchema;
      if (additionalTypes.length) {
        const mergedTypes = [...baseTypes];
        const baseTypeNames = baseTypes.map(type => type.name);
        additionalTypes.forEach(additionalType => {
          if (!baseTypeNames.includes(additionalType.name)) {
            mergedTypes.push(additionalType);
          }
        });
        return mergedTypes;
      }
    }
    return baseTypes;
  }
}

export { ParseGraphQLSchema };
